import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { DebitAdviceCategory } from "src/entities/DebitAdviceCategory";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";

@Injectable()
export class DebitAdviceCategorySyncService {
  constructor(
    @InjectRepository(DebitAdviceCategory)
    private readonly debitAdviceCategoryRepository: Repository<DebitAdviceCategory>,

    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async syncDebitAdviceCategories(batchSize = 1000) {
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
        process.env.BOS_DEBITCAT_API!,
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

      const categories = response.data.data.categories;

      if (!Array.isArray(categories) || categories.length === 0) {
        logger.warn("No Debit Advice Category records returned.");
        return result;
      }

      logger.info(
        `Retrieved ${categories.length} Debit Advice Category records.`,
      );

      const existingCategories =
        await this.debitAdviceCategoryRepository.find();

      const categoryCodeMap = new Map(
        existingCategories.map((item) => [item.category_code, item]),
      );

      const oldCodeMap = new Map(
        existingCategories
          .filter((item) => item.old_code)
          .map((item) => [item.old_code, item]),
      );

      const inserts: DebitAdviceCategory[] = [];
      const updates: DebitAdviceCategory[] = [];

      for (const row of categories) {
        try {
          const categoryCode = row.CODE?.trim();
          const categoryName = row.NAME?.trim();
          const oldCode = row.U_OLD_CODE?.trim() ?? "";
          const company = row.U_COMPANY?.trim() ?? "";
          const statusId = Number(row.U_STATUS) || 1;

          if (!categoryCode) {
            result.skipped++;
            continue;
          }

          let existing = categoryCodeMap.get(categoryCode);

          if (!existing) {
            existing = oldCodeMap.get(categoryCode);
          }

          if (!existing) {
            existing = existingCategories.find(
              (c) => c.category_name?.trim() === categoryName,
            );
          }

          if (existing) {
            let hasChanges = false;

            if (existing.category_code !== categoryCode) {
              existing.old_code = existing.category_code;

              existing.category_code = categoryCode;

              hasChanges = true;
            }

            if (existing.category_name !== categoryName) {
              existing.category_name = categoryName;
              hasChanges = true;
            }

            if (existing.old_code !== oldCode) {
              existing.old_code = oldCode;
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
              updates.push(existing);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            inserts.push(
              this.debitAdviceCategoryRepository.create({
                category_code: categoryCode,
                category_name: categoryName,
                old_code: oldCode,
                company,
                status_id: statusId,
              }),
            );

            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing Category ${row?.CODE}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      // Get all category codes returned from BOS
      const bosCategoryCodes = new Set(
        categories.map((row) => row.CODE?.trim()).filter((code) => !!code),
      );

      // Mark OSH records that no longer exist in BOS as Inactive
      for (const existing of existingCategories) {
        const existsInBos =
          bosCategoryCodes.has(existing.category_code) ||
          (existing.old_code && bosCategoryCodes.has(existing.old_code));

        if (!existsInBos && existing.status_id !== 14) {
          existing.status_id = 14;
          updates.push(existing);
          result.updated++;
        }
      }

      if (inserts.length > 0) {
        const saved = await this.debitAdviceCategoryRepository.save(inserts, {
          chunk: batchSize,
        });

        for (const item of saved) {
          this.sseEventEmitter.emitCreateSignal(
            "debit-advice-category",
            item.id,
          );
        }
      }

      if (updates.length > 0) {
        const saved = await this.debitAdviceCategoryRepository.save(updates, {
          chunk: batchSize,
        });

        for (const item of saved) {
          this.sseEventEmitter.emitUpdateSignal(
            "debit-advice-category",
            item.id,
          );
        }
      }

      return result;
    } catch (error) {
      logger.error(
        `Debit Advice Category sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}
