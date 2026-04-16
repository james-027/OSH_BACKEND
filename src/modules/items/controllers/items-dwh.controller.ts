import { Controller, Post, Body, Query } from "@nestjs/common";
import { ItemsDwhService } from "../services/items-dwh.service";

@Controller("items-dwh")
export class ItemsDwhController {
  constructor(private readonly itemsDwhService: ItemsDwhService) {}

  @Post("pull-and-insert")
  async pull(@Query("batchSize") batchSize?: number) {
    return this.itemsDwhService.pullAndInsertFromDwh(batchSize || 1000);
  }
}
