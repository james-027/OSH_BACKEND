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
      const { data } = await axios.get(process.env.BOS_DEBITCAT_API!, {
        auth: {
          username: process.env.POS_USERNAME,
          password: process.env.POS_PASSWORD,
        },
      });

      if (!Array.isArray(data) || data.length === 0) {
        logger.warn("No Debit Advice Category records returned.");
        return result;
      }

      logger.info(`Retrieved ${data.length} Debit Advice Category records.`);

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

      for (const row of data) {
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
