import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { Supplier } from "src/entities/Supplier";
import logger from "src/config/logger";
@Injectable()
export class SupplierSyncService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async syncSuppliers(batchSize) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const url = "http://10.2.0.156:81/ctgi/syncsuppliertoOSH.php";

      // -----------------------------------------
      // STEP 1: Fetch supplier data
      // -----------------------------------------
      const { data } = await axios.get(url);

      if (!Array.isArray(data) || data.length === 0) {
        logger.warn("No supplier records returned.");
        return result;
      }

      logger.info(`Retrieved ${data.length} supplier records.`);

      // -----------------------------------------
      // STEP 2: Load existing suppliers ONCE
      // -----------------------------------------
      const existingSuppliers = await this.supplierRepository.find();

      const supplierMap = new Map(
        existingSuppliers.map((item) => [item.supplier_code, item]),
      );

      // -----------------------------------------
      // STEP 3: Prepare batch arrays
      // -----------------------------------------
      const inserts: Supplier[] = [];
      const updates: Supplier[] = [];

      for (const row of data) {
        try {
          const supplierCode = row.SUPPNO?.trim();
          const supplierName = row.SUPPNAME?.trim();
          const oldCode = row.U_OLD_EBT_CODE ?? null;

          if (!supplierCode) {
            result.skipped++;
            continue;
          }

          const existing = supplierMap.get(supplierCode);

          if (existing) {
            let hasChanges = false;

            if (existing.supplier_name !== supplierName) {
              existing.supplier_name = supplierName;
              hasChanges = true;
            }

            if (existing.old_code !== oldCode) {
              existing.old_code = oldCode;
              hasChanges = true;
            }

            if (hasChanges) {
              updates.push(existing);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            inserts.push(
              this.supplierRepository.create({
                supplier_code: supplierCode,
                supplier_name: supplierName,
                old_code: oldCode,
                status_id: 1,
              }),
            );

            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing supplier ${row?.SUPPNO}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      // STEP 4: Batch insert
      if (inserts.length > 0) {
        await this.supplierRepository.save(inserts, {
          chunk: batchSize,
        });
      }

      // STEP 5: Batch update
      if (updates.length > 0) {
        await this.supplierRepository.save(updates, {
          chunk: batchSize,
        });
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
