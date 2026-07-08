import { Module } from "@nestjs/common";
import { WarehouseDwhScheduler } from "../../schedulers/warehouse-dwh.scheduler";
import { ItemsDwhScheduler } from "../../schedulers/items-dwh.scheduler";
import { SalesTransactionsDwhScheduler } from "../../schedulers/sales-transactions-dwh.scheduler";
import { WarehousesModule } from "../warehouses/warehouses.module";
import { ItemsModule } from "../items/items.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { SalesBudgetTransactionsDwhScheduler } from "src/schedulers/sales-budget-transactions-dwh.scheduler";
import { OSHJVPostingScheduler } from "src/schedulers/debit-advice-jv-posting.scheduler";
import { DebitAdviceModule } from "../debit-advice/debit-advice.module";
import { StaffTransferScheduler } from "src/schedulers/staff-transfer.scheduler";
import { StaffsModule } from "../staffs/staffs.module";
@Module({
  imports: [WarehousesModule, ItemsModule, TransactionsModule, DebitAdviceModule,StaffsModule],
  providers: [
    WarehouseDwhScheduler,
    ItemsDwhScheduler,
    SalesTransactionsDwhScheduler,
    SalesBudgetTransactionsDwhScheduler,
    OSHJVPostingScheduler,
    StaffTransferScheduler
  ],
  exports: [
    WarehouseDwhScheduler,
    ItemsDwhScheduler,
    SalesTransactionsDwhScheduler,
    SalesBudgetTransactionsDwhScheduler,
    OSHJVPostingScheduler,
    StaffTransferScheduler
  ],
})
export class SchedulersModule { }
