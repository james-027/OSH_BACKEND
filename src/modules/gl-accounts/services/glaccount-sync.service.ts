import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import axios from "axios";

import { GLAccounts } from "src/entities/GLAccounts";
import logger from "src/config/logger";

@Injectable()
export class GLAccountSyncService {
  constructor(
    @InjectRepository(GLAccounts)
    private readonly glAccountRepository: Repository<GLAccounts>,
  ) {}

  async syncGLAccounts(batchSize = 1000) {
    const result = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      const { data } = await axios.get(process.env.BOS_GLACCOUNT_API!, {
        auth: {
          username: process.env.POS_USERNAME,
          password: process.env.POS_PASSWORD,
        },
      });

      if (!Array.isArray(data) || data.length === 0) {
        logger.warn("No GL Account records returned.");
        return result;
      }

      logger.info(`Retrieved ${data.length} GL Account records.`);

      const existingAccounts = await this.glAccountRepository.find();

      const accountMap = new Map(
        existingAccounts.map((item) => [item.gl_code, item]),
      );

      const inserts: GLAccounts[] = [];
      const updates: GLAccounts[] = [];

      for (const row of data) {
        try {
          const accountCode = row.ACCTCODE?.trim();
          const accountName = row.ACCTNAME?.trim();

          if (!accountCode) {
            result.skipped++;
            continue;
          }

          const existing = accountMap.get(accountCode);

          if (existing) {
            let hasChanges = false;

            if (existing.gl_name !== accountName) {
              existing.gl_name = accountName;
              hasChanges = true;
            }
            // Include only if your entity has a company field
            if (
              "company" in existing &&
              existing.company !== (row.u_company?.trim() ?? "")
            ) {
              existing.company = row.u_company?.trim() ?? "";
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
              this.glAccountRepository.create({
                gl_code: accountCode,
                gl_name: accountName,
                old_code: accountCode, // same pattern as your supplier sync
                status_id: 1,
              }),
            );

            result.inserted++;
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

      if (inserts.length > 0) {
        await this.glAccountRepository.save(inserts, {
          chunk: batchSize,
        });
      }

      if (updates.length > 0) {
        await this.glAccountRepository.save(updates, {
          chunk: batchSize,
        });
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
