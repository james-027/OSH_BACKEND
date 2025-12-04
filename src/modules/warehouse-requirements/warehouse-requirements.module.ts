import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WarehouseRequirement } from "../../entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "../../entities/WarehouseRequirementDue";
import { WarehouseRequirementStart } from "../../entities/WarehouseRequirementStart";
import { SyncLog } from "../../entities/syncLog";
import { Warehouse } from "../../entities/Warehouse";
import { Requirement } from "../../entities/Requirement";
import { WarehouseRequirementsService } from "../../services/warehouse-requirements.service";
import { WarehouseRequirementDuesService } from "../../services/warehouse-requirement-dues.service";
import { WarehouseRequirementStartsService } from "../../services/warehouse-requirement-starts.service";
import { WarehouseRequirementsSyncController } from "../../controllers/warehouse-requirements-sync.controller";
import { WarehouseRequirementsSyncScheduler } from "../../schedulers/warehouse-requirements-sync.scheduler";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarehouseRequirement,
      WarehouseRequirementDue,
      WarehouseRequirementStart,
      SyncLog,
      Warehouse,
      Requirement,
      AppModule,
      Action,
      UserPermissions,
    ]),
    UsersModule,
    UserAuditTrailModule,
  ],
  controllers: [WarehouseRequirementsSyncController],
  providers: [
    WarehouseRequirementsService,
    WarehouseRequirementDuesService,
    WarehouseRequirementStartsService,
    WarehouseRequirementsSyncScheduler,
    ResponseMapperService,
  ],
  exports: [
    WarehouseRequirementsService,
    WarehouseRequirementDuesService,
    WarehouseRequirementStartsService,
  ],
})
export class WarehouseRequirementsModule {}
