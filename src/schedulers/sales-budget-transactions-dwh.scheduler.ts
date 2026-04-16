import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SalesBudgetTransactionsDwhService } from "../modules/transactions/services/sales-budget-transactions-dwh.service";

@Injectable()
export class SalesBudgetTransactionsDwhScheduler {
  constructor(private readonly dwhService: SalesBudgetTransactionsDwhService) {}

  // Runs every day at 3:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleScheduledPull() {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);
    // await this.dwhService.pullAndInsertFromDwh({
    //   // You can customize these values as needed or use the defaults
    //   batchSize: 2000,
    //   accessKeyId: 1,
    //   statusId: 1,
    //   database: "budgeting_2025_prod_db",
    //   salesYear: today.getFullYear(),
    //   materialGroups: [5, 6],
    // });
  }
}
