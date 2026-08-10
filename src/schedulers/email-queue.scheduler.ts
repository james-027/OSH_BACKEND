import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { EmailQueueService } from "src/modules/email-queue/services/email-queue.service";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";
@Injectable()
export class EmailQueueScheduler {
  constructor(private readonly emailQueueService: EmailQueueService) {}

  //   @Cron(CronExpression.EVERY_MINUTE)
  @ConditionalCron("0 * * * * *", "ENABLE_EMAIL_QUEUE_CRON")
  async handleCron() {
    await this.emailQueueService.processPendingQueue();
  }
}
