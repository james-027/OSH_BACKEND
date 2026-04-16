import { Controller, Post } from "@nestjs/common";
import { WarehouseDwhService } from "../services/warehouse-dwh.service";
import { Cron, CronExpression } from "@nestjs/schedule";

@Controller("warehouse-dwh")
export class WarehouseDwhController {
  constructor(private readonly dwhService: WarehouseDwhService) {}

  @Post("pull")
  async pullAndInsert() {
    const accessKeyId = 1; // CTGI key
    const batchSize = 1000; // Default batch size
    return this.dwhService.pullAndInsertFromOutlets(batchSize, accessKeyId);
  }

  // Optionally, trigger scheduled pull manually
  @Post("scheduled-pull")
  async scheduledPull() {
    const accessKeyId = 1; // CTGI key
    const batchSize = 1000; // Default batch size
    await this.dwhService.scheduledPullAndInsertFromOutlets(
      batchSize,
      accessKeyId,
    );
    return { message: "Scheduled pull executed." };
  }
}
