import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {  WarehouseMasterDataService } from "src/modules/warehouses/services/warehouse-masterdata.service";
import logger from "src/config/logger";
import { ConditionalCron } from "src/decorators/conditional-cron.decorator";


@Injectable()
export class WarehouseMasterDataScheduler {
  constructor(private readonly warehouseMasterDataService: WarehouseMasterDataService) {}
  // Every 5 seconds (for testing)

  @ConditionalCron("*/5 * * * * *", "ENABLE_WAREHOUSE_MASTERDATA_CRON")
  async handleCron() {
    try {
      const result = await this.warehouseMasterDataService.syncWarehouses();
    
      console.log(result);
    } catch (error) {
      logger.error(
        `Warehouse Master Data Scheduler failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
