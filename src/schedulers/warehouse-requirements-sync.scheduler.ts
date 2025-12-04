import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WarehouseRequirementsService } from "../services/warehouse-requirements.service";

@Injectable()
export class WarehouseRequirementsSyncScheduler {
  private readonly logger = new Logger(WarehouseRequirementsSyncScheduler.name);

  constructor(
    private readonly warehouseRequirementsService: WarehouseRequirementsService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleWarehouseRequirementsSync() {
    this.logger.log("Starting warehouse requirements sync...");

    try {
      const result =
        await this.warehouseRequirementsService.syncWarehouseRequirements();

      this.logger.log(
        `Warehouse requirements sync completed: ${result.inserted} inserted, ${result.skipped} skipped, ${result.duesCreated} dues created, ${result.duesSkipped} dues skipped, ${result.startsCreated} starts created, ${result.startsSkipped} starts skipped, ${result.errors.length} errors`
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          `Sync errors: ${JSON.stringify(result.errors.slice(0, 5))}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync warehouse requirements: ${error.message}`,
        error.stack
      );
    }
  }
}
