import { Module } from "@nestjs/common";

import { MasterDataSyncController } from "./controllers/master-data-sync.controller";
import { MasterDataSyncService } from "./services/master-data-sync.service";

import { SupplierModule } from "../suppliers/supplier.module";
import { ProfitcenterModule } from "../profitcenters/profitcenter.module";
import { GlAccountsModule } from "../gl-accounts/gl-accounts.module";
import { DebitAdviceCategoryModule } from "../debit-advice-category/debit-advice-category.module";
import { DebitAdviceGlAccountModule } from "../debit-advice-glaccount/debit-advice-glaccount.module";
import { TypeOrmModule } from "@nestjs/typeorm";

import { MasterDataSyncLog } from "src/entities/MasterDataSyncLog";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as PermissionModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";
import { MasterDataSyncLogService } from "./services/master-data-sync-log.service";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterDataSyncLog,
      UserPermissions,
      PermissionModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
    SupplierModule,
    ProfitcenterModule,
    GlAccountsModule,
    DebitAdviceCategoryModule,
    DebitAdviceGlAccountModule,
  ],
  controllers: [MasterDataSyncController],
  providers: [MasterDataSyncService, MasterDataSyncLogService],
})
export class MasterDataSyncModule {}
