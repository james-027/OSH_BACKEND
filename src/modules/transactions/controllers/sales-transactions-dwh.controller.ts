import { Controller, Post, Body } from "@nestjs/common";
import { SalesTransactionsDwhService } from "../services/sales-transactions-dwh.service";

@Controller("sales-transactions-dwh")
export class SalesTransactionsDwhController {
  constructor(private readonly dwhService: SalesTransactionsDwhService) {}

  @Post("pull-and-insert")
  async manualSync(
    @Body()
    body: {
      startDate: string;
      endDate: string;
      batchSize?: number;
      category?: string;
    },
  ) {
    // Example body: { startDate: '2025-05-01', endDate: '2025-05-31', batchSize: 1000 }
    return this.dwhService.pullAndInsertFromDwh({
      startDate: body.startDate,
      endDate: body.endDate,
      batchSize: body.batchSize || 1000,
      category: body.category || "ROASTED CHICKEN",
    });
  }
}
