import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DebitAdviceGlAccountSyncService } from "src/modules/debit-advice-glaccount/services/debit-advice-glaccount-sync.service";

@Injectable()
export class DebitAdviceGlAccountScheduler {
  constructor(private readonly syncService: DebitAdviceGlAccountSyncService) {}

  // @Cron("*/5 * * * * *")
  // @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    await this.syncService.syncDebitAdviceGL();
  }
}
