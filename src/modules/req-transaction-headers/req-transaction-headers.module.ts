import { Module, Req } from "@nestjs/common";
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
import { RequirementsModule } from "../requirements/requirements.module";
import { ReqTransactionDue } from "src/entities/ReqTransactionDue";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { SSEModule } from "../sse/sse.module";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { CacheInvalidationModule } from "../cache/cache.module";

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
      ReqTransactionDue,
      ReqTransactionDetail,
      TransactionSequence,
    ]),
    UsersModule,
    UserAuditTrailModule,
    ReqTransactionDetailsModule,
    ReqTransactionDuesModule,
    WarehouseRequirementsModule,
    RequirementsModule,
    SSEModule,
    CacheInvalidationModule,
  ],
  controllers: [ReqTransactionHeadersController],
  providers: [
    ReqTransactionHeadersService,
    ResponseMapperService,
    CommonUtilitiesService,
  ],
  exports: [ReqTransactionHeadersService],
})
export class ReqTransactionHeadersModule {}
