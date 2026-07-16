import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { DebitAdviceGLAccounts } from "src/entities/DebitAdviceGLAccounts";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";

@Injectable()
export class DebitAdviceGlAccountSyncService {
  constructor(
    @InjectRepository(DebitAdviceGLAccounts)
    private readonly repository: Repository<DebitAdviceGLAccounts>,

    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async syncDebitAdviceGL(batchSize = 1000) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const url = process.env.BOS_DEBITGL_API;
      const jwt = process.env.BOS_JWT;
      const user = process.env.BOS_USER;

      const { data } = await axios.get(url!, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "X-User": user, // Remove this if your API doesn't require it
        },
      });

      if (!Array.isArray(data) || data.length === 0) {
        logger.warn("No Debit Advice GL records returned.");
        return result;
      }

      logger.info(`Retrieved ${data.length} Debit Advice GL records.`);

      const existingRecords = await this.repository.find();

      const glCodeMap = new Map(existingRecords.map((x) => [x.gl_code, x]));

      const oldCodeMap = new Map(
        existingRecords.filter((x) => x.old_code).map((x) => [x.old_code, x]),
      );

      const inserts: DebitAdviceGLAccounts[] = [];
      const updates: DebitAdviceGLAccounts[] = [];

      for (const row of data) {
        try {
          const categoryCode = row.CODE?.trim();
          const categoryName = row.NAME?.trim();

          const glCode = row.U_GL_CODE?.trim();
          const glName = row.U_GL_NAME?.trim();

          const oldCode = row.U_GL_OLD_CODE?.trim() ?? "";

          const statusId = Number(row.U_STATUS) || 1;

          if (!glCode) {
            result.skipped++;
            continue;
          }

          let existing = glCodeMap.get(glCode);

          if (!existing) {
            existing = oldCodeMap.get(glCode);
          }

          if (!existing) {
            existing = existingRecords.find(
              (g) => g.gl_name?.trim() === glName,
            );
          }

          if (existing) {
            let hasChanges = false;

            if (existing.gl_code !== glCode) {
              existing.old_code = existing.gl_code;

              existing.gl_code = glCode;

              hasChanges = true;
            }

            if (existing.category_code !== categoryCode) {
              existing.category_code = categoryCode;

              hasChanges = true;
            }

            if (existing.category_name !== categoryName) {
              existing.category_name = categoryName;

              hasChanges = true;
            }

            if (existing.gl_name !== glName) {
              existing.gl_name = glName;

              hasChanges = true;
            }

            if (existing.old_code !== oldCode) {
              existing.old_code = oldCode;

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
              this.repository.create({
                category_code: categoryCode,
                category_name: categoryName,
                gl_code: glCode,
                gl_name: glName,
                old_code: oldCode,
                status_id: statusId,
              }),
            );

            result.inserted++;
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing ${row?.U_GL_CODE}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      if (inserts.length) {
        const saved = await this.repository.save(inserts, {
          chunk: batchSize,
        });

        saved.forEach((x) =>
          this.sseEventEmitter.emitCreateSignal(
            "debit-advice-gl-account",
            x.id,
          ),
        );
      }

      if (updates.length) {
        const saved = await this.repository.save(updates, {
          chunk: batchSize,
        });

        saved.forEach((x) =>
          this.sseEventEmitter.emitUpdateSignal(
            "debit-advice-gl-account",
            x.id,
          ),
        );
      }

      return result;
    } catch (error) {
      logger.error(
        `Debit Advice GL sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}
