import { Injectable } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import logger from "../config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";
import { StaffPayrollService } from "src/modules/staff-payroll/services/staff-payroll.service";

const dayjs = require("dayjs");

@Injectable()
export class PayrollComputationService {
  constructor(
    private readonly staffPayrollService: StaffPayrollService,
  ) {}

  @ConditionalCron(CronExpression.EVERY_DAY_AT_11AM, "ENABLE_PAYROLL_COMPUTATION_CRON")
  async handleDailyScheduleSync() {

    logger.info(`PayrollComputation] Computation triggered for base date`);
    try {
      await this.staffPayrollService.autoPayrollComputation();
      logger.info(`[PayrollComputation] Completed sync for date:`);
    } catch (error: any) {
      const errorMsg = error.getResponse ? JSON.stringify(error.getResponse()) : error.message;
      logger.error(`[PayrollComputation] Computation syncing for date : ${errorMsg}`, error.stack);
    }
  }
}