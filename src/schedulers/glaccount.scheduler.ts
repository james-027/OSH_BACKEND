import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { GLAccountSyncService } from "src/modules/gl-accounts/services/glaccount-sync.service";
import logger from "src/config/logger";

@Injectable()
export class GLAccountScheduler {
  constructor(private readonly glAccountSyncService: GLAccountSyncService) {}

  // Every 30 minutes
  // @Cron(CronExpression.EVERY_30_MINUTES)

  // Every 5 seconds (for testing)
  @Cron("*/5 * * * * *")
  async handleCron() {
    try {
      const result = await this.glAccountSyncService.syncGLAccounts(1000);

      logger.info(
        `GL Account Sync: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors.`,
      );
    } catch (error) {
      logger.error(
        `GL Account Scheduler failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
