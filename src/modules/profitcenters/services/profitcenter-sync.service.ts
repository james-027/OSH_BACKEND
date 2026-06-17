import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { Profitcenter } from "src/entities/Profitcenter";
import logger from "src/config/logger";

@Injectable()
export class ProfitcenterSyncService {
  constructor(
    @InjectRepository(Profitcenter)
    private readonly profitcenterRepository: Repository<Profitcenter>,
  ) {}

  async syncProfitcenters(batchSize = 1000) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const { data } = await axios.get(process.env.BOS_PROFITCENTER_API!, {
        auth: {
          username: process.env.POS_USERNAME,
          password: process.env.POS_PASSWORD,
        },
      });

      if (!Array.isArray(data) || data.length === 0) {
        logger.warn("No profit center records returned.");
        return result;
      }

      logger.info(`Retrieved ${data.length} profit center records.`);

      // Load existing records once
      const existingProfitcenters = await this.profitcenterRepository.find();

      const profitcenterMap = new Map(
        existingProfitcenters.map((item) => [item.profitcenter_code, item]),
      );

      const oldCodeMap = new Map(
        existingProfitcenters
          .filter((item) => item.old_code)
          .map((item) => [item.old_code, item]),
      );

      const inserts: Profitcenter[] = [];
      const updates: Profitcenter[] = [];

      for (const row of data) {
        try {
          const profitcenterCode = row.PROFITCENTER?.trim();
          const profitcenterName = row.PROFITCENTERNAME?.trim();
          const businessCenter = row.U_BC?.trim() ?? "";
          const company = row.U_COMPANY?.trim();
          if (!profitcenterCode) {
            result.skipped++;
            continue;
          }

          let existing = profitcenterMap.get(profitcenterCode);

          // Try matching by old_code if not found
          if (!existing) {
            existing = oldCodeMap.get(profitcenterCode);
          }

          if (!existing) {
            existing = existingProfitcenters.find(
              (p) => p.profitcenter_name?.trim() === profitcenterName,
            );
          }
          if (existing) {
            let hasChanges = false;

            // Code changed -> preserve previous code
            if (existing.profitcenter_code !== profitcenterCode) {
              existing.old_code = existing.profitcenter_code;
              existing.profitcenter_code = profitcenterCode;
              hasChanges = true;
            }

            if (existing.profitcenter_name !== profitcenterName) {
              existing.profitcenter_name = profitcenterName;
              hasChanges = true;
            }

            // If you have a separate business_center column:
            if (existing.business_center !== businessCenter) {
              existing.business_center = businessCenter;
              hasChanges = true;
            }

            if (existing.company !== company) {
              existing.company = company;
              hasChanges = true;
            }

            if (hasChanges) {
              updates.push(existing);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            existing = oldCodeMap.get(profitcenterCode);

            if (existing) {
              // Preserve the previous supplier_code as old_code
              existing.old_code = existing.profitcenter_code;
              existing.profitcenter_code = profitcenterCode;
              existing.profitcenter_name = profitcenterName;
              existing.business_center = businessCenter;
              existing.company = company;

              updates.push(existing);
              result.updated++;
            } else {
              inserts.push(
                this.profitcenterRepository.create({
                  profitcenter_code: profitcenterCode,
                  profitcenter_name: profitcenterName,

                  // Same approach as SupplierSyncService
                  old_code: profitcenterCode,

                  // Store U_BC in its own column
                  business_center: businessCenter,

                  company,
                  status_id: 1,
                }),
              );
            }

            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing profit center ${row?.PROFITCENTER}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      // Batch insert
      if (inserts.length > 0) {
        await this.profitcenterRepository.save(inserts, {
          chunk: batchSize,
        });
      }

      // Batch update
      if (updates.length > 0) {
        await this.profitcenterRepository.save(updates, {
          chunk: batchSize,
        });
      }

      return result;
    } catch (error) {
      logger.error(
        `Profit center sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}
