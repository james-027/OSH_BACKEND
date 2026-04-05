import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WarehouseRequirement } from "../../entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "../../entities/WarehouseRequirementDue";
import { WarehouseRequirementStart } from "../../entities/WarehouseRequirementStart";
import { ReqTransactionHeader } from "../../entities/ReqTransactionHeader";
import { ReqTransactionDetail } from "../../entities/ReqTransactionDetail";
import { SyncLog } from "../../entities/syncLog";
import { Warehouse } from "../../entities/Warehouse";
import { Requirement } from "../../entities/Requirement";
import { WarehouseRequirementsService } from "../../services/warehouse-requirements.service";
import { WarehouseRequirementDuesService } from "../../services/warehouse-requirement-dues.service";
import { WarehouseRequirementStartsService } from "../../services/warehouse-requirement-starts.service";
import { CommonUtilitiesService } from "../../services/common-utilities.service";
import { WarehouseRequirementsSyncScheduler } from "../../schedulers/warehouse-requirements-sync.scheduler";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { RequirementsModule } from "../requirements/requirements.module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { TransactionSequence } from "src/entities/TransactionSequence";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseRequirement,
      WarehouseRequirementDue,
      WarehouseRequirementStart,
      ReqTransactionHeader,
      ReqTransactionDetail,
      SyncLog,
      Warehouse,
      Requirement,
      AppModule,
      Action,
      UserPermissions,
      TransactionSequence,
    ]),
    UsersModule,
    UserAuditTrailModule,
    forwardRef(() => RequirementsModule),
    SSEModule,
  ],
  controllers: [],
  providers: [
    WarehouseRequirementsService,
    WarehouseRequirementDuesService,
    WarehouseRequirementStartsService,
    WarehouseRequirementsSyncScheduler,
    ResponseMapperService,
    CommonUtilitiesService,
  ],
  exports: [
    WarehouseRequirementsService,
    WarehouseRequirementDuesService,
    WarehouseRequirementStartsService,
  ],
})
export class WarehouseRequirementsModule {}
