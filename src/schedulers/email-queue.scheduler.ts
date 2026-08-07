import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { EmailQueueService } from "src/modules/email-queue/services/email-queue.service";
import logger from "src/config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";
@Injectable()
export class EmailQueueScheduler {
  constructor(private readonly emailQueueService: EmailQueueService) {}

  //   @Cron(CronExpression.EVERY_MINUTE)
  @ConditionalCron("0 * * * * *", "ENABLE_EMAIL_QUEUE_CRON")
  async handleCron() {
    logger.warn(`PID=${process.pid} PROCESS QUEUE`);
    await this.emailQueueService.processPendingQueue();
  }
}
