import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WarehouseRequirementsService } from "../services/warehouse-requirements.service";
import logger from "../config/logger";

@Injectable()
export class WarehouseRequirementsSyncScheduler {
  // private readonly logger = new Logger(WarehouseRequirementsSyncScheduler.name);

  constructor(
    private readonly warehouseRequirementsService: WarehouseRequirementsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleWarehouseRequirementsSync() {
    logger.info("Starting warehouse requirements sync...");

    try {
      // const year = new Date().getFullYear();
      const year = Number(process.env.SYNC_YEAR) || new Date().getFullYear();
      const result =
        await this.warehouseRequirementsService.syncWarehouseRequirements(year);

      logger.info(
        `Warehouse requirements sync completed: ${result.inserted} inserted, ${result.skipped} skipped, ${result.duesCreated} dues created, ${result.duesSkipped} dues skipped, ${result.startsCreated} starts created, ${result.startsSkipped} starts skipped, ${result.errors.length} errors for year of ${year}`,
      );

      if (result.errors.length > 0) {
        logger.error(
          `Sync errors: ${JSON.stringify(result.errors.slice(0, 5))}`,
        );
      }
    } catch (error) {
      logger.error(
        `Failed to sync warehouse requirements: ${error.message}`,
        error.stack,
      );
    }
  }
}
