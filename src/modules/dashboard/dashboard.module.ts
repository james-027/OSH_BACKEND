import { Module } from "@nestjs/common";
import { DashboardController } from "../../controllers/dashboard.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { ActionsModule } from "../actions/actions.module";
import { Action } from "src/entities/Action";
import { TransactionsModule } from "../transactions/transactions.module";
import { WarehouseRequirementsModule } from "../warehouse-requirements/warehouse-requirements.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPermissions, AppModule, Action]),
    ActionsModule,
    TransactionsModule,
    WarehouseRequirementsModule,
  ],
  controllers: [DashboardController],
})
export class DashboardModule {}
