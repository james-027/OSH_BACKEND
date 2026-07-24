import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SupplierSyncService } from "src/modules/suppliers/services/supplier-sync.service";
import logger from "src/config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";

@Injectable()
export class SupplierScheduler {
  constructor(private readonly supplierSyncService: SupplierSyncService) {}

  // @Cron(CronExpression.EVERY_2_HOURS)
  // @Cron("*/5 * * * * *")
  @ConditionalCron("0 */2 * * * *", "ENABLE_SUPPLIER_CRON")
  async handleCron() {
    try {
      const batchSize = 1000; // Default batch size

      const result = await this.supplierSyncService.syncSuppliers(batchSize);
      logger.info(
        `Supplier sync completed: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors.`,
      );
    } catch (error) {
      logger.error(
        `Supplier sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
