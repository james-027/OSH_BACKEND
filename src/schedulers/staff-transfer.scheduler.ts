import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import logger from "../config/logger";
import { StaffsService } from "src/modules/staffs/services/staffs.service";

@Injectable()
export class StaffTransferScheduler {
  constructor(
    private readonly staffsService: StaffsService,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
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