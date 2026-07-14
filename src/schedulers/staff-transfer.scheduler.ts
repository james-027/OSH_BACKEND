import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../config/logger";
import { StaffsService } from "src/modules/staffs/services/staffs.service";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";

@Injectable()
export class StaffTransferScheduler {
  constructor(private readonly staffsService: StaffsService) {}

  // @Cron(CronExpression.EVERY_SECOND)
  @ConditionalCron(CronExpression.EVERY_SECOND, "ENABLE_STAFF_TRANSFER_CRON")
  async processScheduledTransfers() {
    try {
      await this.staffsService.processScheduledTransfers();
    } catch (error: any) {
      logger.error(
        `Scheduled staff transfer process failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
