import { Injectable } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import logger from "../config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";
import { StaffSchedulingService } from "src/modules/staff-scheduling/services/staff-scheduling.service";

const dayjs = require("dayjs");

@Injectable()
export class DwsScheduleSyncCronService {
  constructor(
    private readonly staffSchedulingService: StaffSchedulingService,
  ) {}

  @ConditionalCron(CronExpression.EVERY_DAY_AT_11AM, "ENABLE_DWS_SCHEDULE_SYNC_CRON")
  async handleDailyScheduleSync() {
     const targetDate = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    // const targetDate = dayjs().format("YYYY-MM-DD");
    logger.info(`[DwsScheduleSync] Scheduler triggered for base date: ${targetDate}`);

    try {
      await this.staffSchedulingService.syncDwsSchedulesByDate(targetDate);
      logger.info(`[DwsScheduleSync] Completed sync for date: ${targetDate}`);
    } catch (error: any) {
      const errorMsg = error.getResponse ? JSON.stringify(error.getResponse()) : error.message;
      logger.error(`[DwsScheduleSync] Scheduler failed for date ${targetDate}: ${errorMsg}`, error.stack);
    }
  }
}