import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { Supplier } from "src/entities/Supplier";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
@Injectable()
export class SupplierSyncService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  /** Normalize a value for comparison: null/undefined → "", trimmed string. */
  private norm(value: unknown): string {
    return (value ?? "").toString().trim();
  }

  async syncSuppliers(batchSize) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const requestBody = {
        userid: process.env.BOS_USER,
        jwt: process.env.BOS_JWT,
      };

      const response = await axios.post(
        process.env.BOS_SUPPLIER_API!,
        requestBody,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.data.success) {
        throw new Error(response.data.message);
      }

      const suppliers = response.data.data.suppliers;

      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        logger.warn("No supplier records returned.");
        return result;
      }

      logger.info(`Retrieved ${suppliers.length} supplier records.`);

      // -----------------------------------------
      // STEP 2: Load existing suppliers ONCE
      // -----------------------------------------
      const existingSuppliers = await this.supplierRepository.find();

      // Create maps
      const supplierMap = new Map(
        existingSuppliers.map((item) => [item.supplier_code?.trim(), item]),
      );



      // -----------------------------------------
      // STEP 3: Prepare batch arrays
      // -----------------------------------------
      const inserts: Supplier[] = [];
      const updates: Supplier[] = [];
      const updatedIds = new Set<number>();
      const updatedLog: string[] = [];
      const insertedLog: string[] = [];

      for (const row of suppliers) {
        try {
          const supplierCode = row.suppno?.trim();
          const supplierName = row.suppname?.trim();
          const groupCode = row.suppgroup?.trim();
          const groupName = row.groupname?.trim();
          const taxId = row.taxid?.trim();
          const company = row.u_company?.trim();
          const statusId = Number(row.u_status) || 1;
          if (!supplierCode) {
            result.skipped++;
            continue;
          }

          // Match strictly by supplier_code. It is the primary (and only) key,
          // so a code BOS sends that we don't have is inserted as a new
          // supplier rather than merged onto an existing record via old_code /
          // tax id (which caused distinct suppliers to ping-pong every sync).
          const existing = supplierMap.get(supplierCode);

          if (existing) {
            const changes: string[] = [];

            if (existing.supplier_code !== supplierCode) {
              changes.push(
                `supplier_code: "${existing.supplier_code}" -> "${supplierCode}"`,
              );
              existing.old_code = existing.supplier_code;
              existing.supplier_code = supplierCode;
            }
            // Supplier name changed
            if (existing.supplier_name !== supplierName) {
              changes.push(
                `supplier_name: "${existing.supplier_name}" -> "${supplierName}"`,
              );
              existing.supplier_name = supplierName;
            }

            if (existing.group_code !== groupCode) {
              changes.push(
                `group_code: "${existing.group_code}" -> "${groupCode}"`,
              );
              existing.group_code = groupCode;
            }

            if (existing.group_name !== groupName) {
              changes.push(
                `group_name: "${existing.group_name}" -> "${groupName}"`,
              );
              existing.group_name = groupName;
            }

            // Tax ID is now the identifier, so don't update it.
            if (existing.taxid !== taxId) {
              changes.push(`taxid: "${existing.taxid}" -> "${taxId}"`);
              existing.taxid = taxId;
            }

            if (existing.company !== company) {
              changes.push(`company: "${existing.company}" -> "${company}"`);
              existing.company = company;
            }

            if (existing.status_id !== statusId) {
              changes.push(
                `status_id: "${existing.status_id}" -> "${statusId}"`,
              );
              existing.status_id = statusId;
            }

            const hasChanges = changes.length > 0;
            if (hasChanges) {
              if (!updatedIds.has(existing.id)) {
                updates.push(existing);
                updatedIds.add(existing.id);
                updatedLog.push(
                  `Supplier ${existing.id} (${existing.supplier_code}) changed: ${changes.join(", ")}`,
                );
                result.updated++;
              }
            } else {
              result.skipped++;
            }
          } else {
            inserts.push(
              this.supplierRepository.create({
                supplier_code: supplierCode,
                supplier_name: supplierName,
                old_code: supplierCode,
                group_code: groupCode,
                group_name: groupName,
                taxid: taxId,
                company: company,
                status_id: statusId,
              }),
            );

            insertedLog.push(`${supplierCode} (${supplierName})`);
            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing supplier ${row?.suppno}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      // Get all supplier codes returned from BOS
      const bosSupplierCodes = new Set(
        suppliers.map((row) => row.suppno?.trim()).filter((code) => !!code),
      );

      // Mark OSH records that no longer exist in BOS as Inactive
      for (const existing of existingSuppliers) {
        const existsInBos = bosSupplierCodes.has(existing.supplier_code);

        if (!existsInBos && existing.status_id !== 14) {
          const previousStatus = existing.status_id;
          existing.status_id = 14;

          if (!updatedIds.has(existing.id)) {
            updates.push(existing);
            updatedIds.add(existing.id);
            updatedLog.push(
              `Supplier ${existing.id} (${existing.supplier_code}) changed: status_id: "${previousStatus}" -> "14"`,
            );
            result.updated++;
          }
        }
      }
      if (inserts.length > 0) {
        this.sseEventEmitter.emitCreateSignal("suppliers", 0);
      }
      if (updates.length > 0) {
        this.sseEventEmitter.emitUpdateSignal("suppliers", 0);
      }

      logger.info(
        `Supplier Updated (${updatedLog.length}):` +
          (updatedLog.length
            ? "\n" + updatedLog.map((line) => `  - ${line}`).join("\n")
            : " none"),
      );
      // -----------------------------------------
      // STEP 4: Save changes to OSH database
      // -----------------------------------------

      if (inserts.length > 0) {
        await this.supplierRepository.save(inserts, {
          chunk: batchSize || 1000,
        });
      }

      if (updates.length > 0) {
        await this.supplierRepository.save(updates, {
          chunk: batchSize || 1000,
        });
      }

      // Emit SSE only after successful database save
     
      this.sseEventEmitter.emitCreateSignal("suppliers", 0);

      this.sseEventEmitter.emitUpdateSignal("suppliers", 0);

      logger.info(
        `Supplier Updated (${updatedLog.length}):` +
          (updatedLog.length
            ? "\n" + updatedLog.map((line) => `  - ${line}`).join("\n")
            : " none"),
      );

      logger.info(
        `Supplier Inserted (${insertedLog.length}):` +
          (insertedLog.length
            ? "\n" + insertedLog.map((code) => `  - ${code}`).join("\n")
            : " none"),
      );

      return result;

      return result;
    } catch (error) {
      logger.error(
        `Supplier sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}
