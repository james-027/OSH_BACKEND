import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ProfitcenterSyncService } from "src/modules/profitcenters/services/profitcenter-sync.service";
import logger from "src/config/logger";

@Injectable()
export class ProfitcenterScheduler {
  constructor(
    private readonly profitcenterSyncService: ProfitcenterSyncService,
  ) {}

  //   @Cron(CronExpression.EVERY_30_MINUTES)
  @Cron("*/5 * * * * *")
  async handleCron() {
    try {
      const result = await this.profitcenterSyncService.syncProfitcenters(1000);

      logger.info(
        `Profit Center Sync: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors.`,
      );
    } catch (error) {
      logger.error(error);
    }
  }
}

