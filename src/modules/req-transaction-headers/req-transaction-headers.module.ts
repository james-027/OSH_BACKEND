import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReqTransactionHeader } from "../../entities/ReqTransactionHeader";
import { Warehouse } from "../../entities/Warehouse";
import { Requirement } from "../../entities/Requirement";
import { WarehouseRequirement } from "../../entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "../../entities/WarehouseRequirementDue";
import { RequirementReminder } from "../../entities/RequirementReminder";
import { SyncLog } from "../../entities/syncLog";
import { ReqTransactionHeadersService } from "../../services/req-transaction-headers.service";
import { ReqTransactionHeadersController } from "../../controllers/req-transaction-headers.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";
import { ReqTransactionDetailsModule } from "../req-transaction-details/req-transaction-details.module";
import { ReqTransactionDuesModule } from "../req-transaction-dues/req-transaction-dues.module";
import { WarehouseRequirementsModule } from "../warehouse-requirements/warehouse-requirements.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReqTransactionHeader,
      Warehouse,
      Requirement,
      WarehouseRequirement,
      WarehouseRequirementDue,
      RequirementReminder,
      SyncLog,
      AppModule,
      Action,
      UserPermissions,
    ]),
    UsersModule,
    UserAuditTrailModule,
    ReqTransactionDetailsModule,
    ReqTransactionDuesModule,
    WarehouseRequirementsModule,
  ],
  controllers: [ReqTransactionHeadersController],
  providers: [ReqTransactionHeadersService, ResponseMapperService],
  exports: [ReqTransactionHeadersService],
})
export class ReqTransactionHeadersModule {}
