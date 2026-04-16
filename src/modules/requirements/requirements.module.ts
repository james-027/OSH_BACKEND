import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Requirement } from "../../entities/Requirement";
import { RequirementReminder } from "../../entities/RequirementReminder";
import { RequirementsController } from "./controllers/requirements.controller";
import { RequirementsService } from "./services/requirements.service";
import { RequirementRemindersService } from "./services/requirement-reminders.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { RenewalType } from "../../entities/RenewalType";
import { SSEModule } from "../sse/sse.module";
import { WarehouseRequirementsModule } from "../warehouse-requirements/warehouse-requirements.module";
import { CacheInvalidationModule } from "../cache/cache.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Requirement,
      RequirementReminder,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      RenewalType,
    ]),
    UsersModule,
    SSEModule,
    forwardRef(() => WarehouseRequirementsModule),
    CacheInvalidationModule,
  ],
  controllers: [RequirementsController],
  providers: [
    RequirementsService,
    RequirementRemindersService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [RequirementsService, RequirementRemindersService],
})
export class RequirementsModule {}
