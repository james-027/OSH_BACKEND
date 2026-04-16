import { Controller, Post, Body, Query } from "@nestjs/common";
import { SalesBudgetTransactionsDwhService } from "../services/sales-budget-transactions-dwh.service";

@Controller("sales-budget-transactions-dwh")
export class SalesBudgetTransactionsDwhController {
  constructor(private readonly dwhService: SalesBudgetTransactionsDwhService) {}

  @Post("pull-and-insert")
  async pullFromDwh(
    @Body()
    body: {
      database?: string;
      salesYear?: number;
      materialGroups?: number[];
    },
  ) {
    return this.dwhService.pullAndInsertFromDwh({
      ...body,
    });
  }
}
