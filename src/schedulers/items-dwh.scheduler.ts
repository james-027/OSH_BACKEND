import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ItemsDwhService } from "src/modules/items/services/items-dwh.service";

@Injectable()
export class ItemsDwhScheduler {
  constructor(private readonly itemsDwhService: ItemsDwhService) {}

  // Runs every day at 2:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    await this.itemsDwhService.pullAndInsertFromDwh();
  }
}
