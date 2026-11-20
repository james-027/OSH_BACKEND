import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "src/config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";
import { CustomerSyncService } from "src/modules/customer/services/customer-sync";

@Injectable()
export class CustomerMasterDataScheduler {
  constructor(private readonly customerSyncService: CustomerSyncService) {}
  // Every 5 seconds (for testing)
  @ConditionalCron(
    CronExpression.EVERY_MINUTE,
    "ENABLE_CUSTOMER_MASTERDATA_CRON",
  )
  async handleCron() {
    try {
      const result = await this.customerSyncService.syncCustomers();

      logger.info(
        `Customer Master Data Sync completed: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      logger.error(
        `Customer Master Data Scheduler failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
