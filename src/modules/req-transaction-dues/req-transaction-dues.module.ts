import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReqTransactionDue } from "../../entities/ReqTransactionDue";
import { ReqTransactionHeader } from "../../entities/ReqTransactionHeader";
import { WarehouseRequirementDue } from "../../entities/WarehouseRequirementDue";
import { SyncLog } from "../../entities/syncLog";
import { ReqTransactionDuesService } from "../../services/req-transaction-dues.service";
import { ReqTransactionDuesController } from "../../controllers/req-transaction-dues.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReqTransactionDue,
      ReqTransactionHeader,
      WarehouseRequirementDue,
      SyncLog,
      AppModule,
      Action,
      UserPermissions,
    ]),
    UsersModule,
    UserAuditTrailModule,
  ],
  controllers: [ReqTransactionDuesController],
  providers: [ReqTransactionDuesService, ResponseMapperService],
  exports: [ReqTransactionDuesService],
})
export class ReqTransactionDuesModule {}
