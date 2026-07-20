import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { GLAccounts } from "src/entities/GLAccounts";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";

@Injectable()
export class GLAccountSyncService {
  constructor(
    @InjectRepository(GLAccounts)
    private readonly glAccountRepository: Repository<GLAccounts>,
    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async syncGLAccounts(batchSize = 1000) {
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
        process.env.BOS_GLACCOUNT_API!,
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

      const glAccounts = response.data.data.glAccounts;

      if (!Array.isArray(glAccounts) || glAccounts.length === 0) {
        logger.warn("No GL Account records returned.");
        return result;
      }

      logger.info(`Retrieved ${glAccounts.length} GL Account records.`);

      const existingAccounts = await this.glAccountRepository.find();

      const accountMap = new Map(
        existingAccounts.map((item) => [item.gl_code, item]),
      );

      const oldCodeMap = new Map(
        existingAccounts
          .filter((item) => item.old_code)
          .map((item) => [item.old_code, item]),
      );

      const inserts: GLAccounts[] = [];
      const updates: GLAccounts[] = [];
      const updatedIds = new Set<number>();
      for (const row of glAccounts) {
        try {
          const accountCode = row.ACCTCODE?.trim();
          const accountName = row.ACCTNAME?.trim();
          const company = row.U_COMPANY?.trim() ?? "";
          const statusId = Number(row.U_STATUS) || 1;

          if (!accountCode) {
            result.skipped++;
            continue;
          }

          let existing = accountMap.get(accountCode);

          // Try matching by old_code
          if (!existing) {
            existing = oldCodeMap.get(accountCode);
          }

          // Fallback to matching by name
          if (!existing) {
            existing = existingAccounts.find(
              (g) => g.gl_name?.trim() === accountName,
            );
          }

          if (existing) {
            let hasChanges = false;

            // Code changed
            if (existing.gl_code !== accountCode) {
              existing.old_code = existing.gl_code;
              existing.gl_code = accountCode;
              hasChanges = true;
            }

            if (existing.gl_name !== accountName) {
              existing.gl_name = accountName;
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
            // Extra check by old_code (same approach as Profitcenter)
            existing = oldCodeMap.get(accountCode);

            if (existing) {
              existing.old_code = existing.gl_code;
              existing.gl_code = accountCode;
              existing.gl_name = accountName;
              existing.company = company;
              existing.status_id = statusId;

              if (!updatedIds.has(existing.id)) {
                updates.push(existing);
                updatedIds.add(existing.id);
                result.updated++;
              }
            } else {
              inserts.push(
                this.glAccountRepository.create({
                  gl_code: accountCode,
                  gl_name: accountName,
                  old_code: accountCode,
                  company,
                  status_id: statusId,
                }),
              );

              result.inserted++;
            }
          }
        } catch (err) {
          result.errors++;

          logger.error(
            `Failed processing GL Account ${row?.ACCTCODE}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
      // Get all GL Account codes returned from BOS
      const bosAccountCodes = new Set(
        glAccounts.map((row) => row.ACCTCODE?.trim()).filter((code) => !!code),
      );

      // Mark OSH records that no longer exist in BOS as Inactive
      // Mark OSH records that no longer exist in BOS as Inactive
      for (const existing of existingAccounts) {
        const existsInBos =
          bosAccountCodes.has(existing.gl_code) ||
          (existing.old_code && bosAccountCodes.has(existing.old_code));

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
        const savedInserts = await this.glAccountRepository.save(inserts, {
          chunk: batchSize,
        });

        for (const item of savedInserts) {
          this.sseEventEmitter.emitCreateSignal("gl-accounts", item.id);
        }
      }
      if (updates.length > 0) {
        const savedUpdates = await this.glAccountRepository.save(updates, {
          chunk: batchSize,
        });

        for (const item of savedUpdates) {
          this.sseEventEmitter.emitUpdateSignal("gl-accounts", item.id);
        }
      }

      return result;
    } catch (error) {
      logger.error(
        `GL Account sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return result;
    }
  }
}
