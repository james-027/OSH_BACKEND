import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RolesController } from "../../controllers/roles.controller";
import { RolesService } from "../../services/roles.service";
import { Role } from "../../entities/Role";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { System } from "src/entities/System";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { Location } from "src/entities/Location";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UsersModule } from "../users/users.module";
import { RoleLocationPresetsService } from "src/services/role-location-presets.service";
import { RoleActionPresetsService } from "src/services/role-action-presets.service";
import { RoleLocationPreset } from "src/entities/RoleLocationPreset";
import { RoleActionPreset } from "src/entities/RoleActionPreset";
import { UserLocations } from "src/entities/UserLocations";
import { AccessKey } from "src/entities/AccessKey";
import {
  RoleActionPresetsController,
  RolePresetsController,
} from "src/controllers/role-action-presets.controller";
import { SSEModule } from "../sse/sse.module";
import { CacheInvalidationModule } from "../cache/cache.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      User,
      AppModule,
      Action,
      Status,
      System,
      Location,
      UserAuditTrail,
      UserPermissions,
      RoleLocationPreset,
      RoleActionPreset,
      UserLocations,
      AccessKey,
    ]),
    UsersModule,
    SSEModule,
    CacheInvalidationModule,
  ],
  controllers: [
    RolesController,
    RoleActionPresetsController,
    RolePresetsController,
  ],
  providers: [
    RolesService,
    UserAuditTrailCreateService,
    RoleLocationPresetsService,
    RoleActionPresetsService,
  ],
  exports: [RolesService, RoleLocationPresetsService, RoleActionPresetsService],
})
export class RolesModule {}
