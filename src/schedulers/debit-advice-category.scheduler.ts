import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DebitAdviceCategorySyncService } from "src/modules/debit-advice-category/services/debit-advice-category-sync";

@Injectable()
export class DebitAdviceCategoryScheduler {
  constructor(private readonly syncService: DebitAdviceCategorySyncService) {}

  // @Cron("*/5 * * * * *")
    @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    await this.syncService.syncDebitAdviceCategories();
  }
}
