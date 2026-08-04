import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WarehouseDwhService } from "../modules/warehouses/services/warehouse-dwh.service";

@Injectable()
export class WarehouseDwhScheduler {
  constructor(private readonly dwhService: WarehouseDwhService) {}

  // Runs every 2 minutes
  @Cron("0 */2 * * * *")
  async handleCron() {
    const accessKeyId = 1; // CTGI key
    const batchSize = 1000; // Default batch size
    await this.dwhService.pullAndInsertFromOutlets(batchSize, accessKeyId);
  }
}
