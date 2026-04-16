import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SalesTransactionsDwhService } from "../modules/transactions/services/sales-transactions-dwh.service";
import logger from "../config/logger";

@Injectable()
export class SalesTransactionsDwhScheduler {
  private readonly logger = new Logger(SalesTransactionsDwhScheduler.name);

  constructor(private readonly dwhService: SalesTransactionsDwhService) {}

  // Runs every day at 2:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    logger.info("Starting scheduled DWH pull for sales transactions...");
    // Default: previous day
    const today = new Date();
    const isFifteenth = today.getDate() === 15;
    if (isFifteenth) {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const start = startDate.toISOString().slice(0, 10);
      const end = endDate.toISOString().slice(0, 10);
      // await this.dwhService.pullAndInsertFromDwh({
      //   startDate: start,
      //   endDate: end,
      // });
      logger.info(
        "Finished scheduled DWH pull for sales transactions. for the date range: " +
          start +
          " to " +
          end,
      );
    }
  }
}
