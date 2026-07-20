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
        existingSuppliers.map((item) => [item.supplier_code, item]),
      );

      const oldCodeMap = new Map(
        existingSuppliers
          .filter((item) => item.old_code)
          .map((item) => [item.old_code, item]),
      );

      // -----------------------------------------
      // STEP 3: Prepare batch arrays
      // -----------------------------------------
      const inserts: Supplier[] = [];
      const updates: Supplier[] = [];
      const updatedIds = new Set<number>();

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

          let existing = supplierMap.get(supplierCode);

          // If not found by supplier_code, try old_code
          if (!existing) {
            existing = oldCodeMap.get(supplierCode);
          }

          // If still not found, try matching by supplier name
          if (!existing) {
            existing = existingSuppliers.find(
              (s) => s.supplier_name?.trim() === supplierName,
            );
          }
          if (existing) {
            let hasChanges = false;

            // Supplier code changed
            if (existing.supplier_code !== supplierCode) {
              console.log(existing.supplier_code);
              existing.old_code = existing.supplier_code;
              existing.supplier_code = supplierCode;
              hasChanges = true;
            }

            // Supplier name changed
            if (existing.supplier_name !== supplierName) {
              existing.supplier_name = supplierName;
              hasChanges = true;
            }

            if (existing.group_code !== groupCode) {
              existing.group_code = groupCode;
              hasChanges = true;
            }

            if (existing.group_name !== groupName) {
              existing.group_name = groupName;
              hasChanges = true;
            }

            if (existing.taxid !== taxId) {
              existing.taxid = taxId;
              hasChanges = true;
            }

            if (existing.company !== company) {
              existing.company = company;
              hasChanges = true;
            }
            if (existing.status_id !== statusId) {
              existing.status_id = statusId;
              hasChanges = true;
            }

            if (hasChanges) {
              if (!updatedIds.has(existing.id)) {
                updates.push(existing);
                updatedIds.add(existing.id);
                result.updated++;
              }
            } else {
              result.skipped++;
            }
          } else {
            // If not found, check whether the new SUPPNO matches an existing old_code
            existing = oldCodeMap.get(supplierCode);

            if (existing) {
              // Preserve the previous supplier_code as old_code
              existing.old_code = existing.supplier_code;
              existing.supplier_code = supplierCode;
              existing.supplier_name = supplierName;
              existing.group_code = groupCode;
              existing.group_name = groupName;
              existing.taxid = taxId;
              existing.company = company;

              if (!updatedIds.has(existing.id)) {
                updates.push(existing);
                updatedIds.add(existing.id);
                result.updated++;
              }
            } else {
              // Completely new supplier
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

              result.inserted++;
            }
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
        const existsInBos =
          bosSupplierCodes.has(existing.supplier_code) ||
          (existing.old_code && bosSupplierCodes.has(existing.old_code));

        if (!existsInBos && existing.status_id !== 14) {
          existing.status_id = 14;

          if (!updatedIds.has(existing.id)) {
            updates.push(existing);
            updatedIds.add(existing.id);
            result.updated++;
          }
        }
      }
      if (inserts.length > 0) {
        const savedInserts = await this.supplierRepository.save(inserts, {
          chunk: batchSize,
        });

        for (const supplier of savedInserts) {
          this.sseEventEmitter.emitCreateSignal("suppliers", supplier.id);
        }
      }
      if (updates.length > 0) {
        const savedUpdates = await this.supplierRepository.save(updates, {
          chunk: batchSize,
        });

        for (const supplier of savedUpdates) {
          this.sseEventEmitter.emitUpdateSignal("suppliers", supplier.id);
        }
      }

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
