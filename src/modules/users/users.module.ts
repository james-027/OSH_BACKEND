import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./services/users.service";
import { User } from "../../entities/User";
import { Role } from "../../entities/Role";
import { Status } from "../../entities/Status";
import { Theme } from "../../entities/Theme";
import { UserPermissions } from "../../entities/UserPermissions";
import { UserLocations } from "../../entities/UserLocations";
import { UserWarehouses } from "../../entities/UserWarehouses";
import { UserVendors } from "../../entities/UserVendor";
import { Vendor } from "../../entities/Vendor";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { AccessKey } from "../../entities/AccessKey";
import { Location } from "../../entities/Location";
import { UsersController } from "./controllers/users.controller";
import { UserAuditTrailCreateService } from "./services/user-audit-trail-create.service";
import { EmailService } from "../../services/email.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserLocationsService } from "src/modules/users/services/user-locations.service";
import { UserLocationsController } from "src/modules/users/controllers/user-locations.controller";
import { UserWarehousesService } from "src/modules/users/services/user-warehouses.service";
import { UserWarehousesController } from "src/modules/users/controllers/user-warehouses.controller";
import { UserAccessKeyService } from "src/modules/users/services/user-access-key.service";
import { UserLoginSession } from "src/entities/UserLoginSession";
import { JwtService } from "@nestjs/jwt";
import { UserSessionService } from "src/modules/users/services/user-session.service";
import { UserPermissionsService } from "src/modules/users/services/user-permissions.service";
import { UserAccessKeyController } from "src/modules/users/controllers/user-access-key.controller";
import { SSEModule } from "../sse/sse.module";
import { FrontendUrlUtil } from "src/utils/frontend-url.util";
import { CacheInvalidationModule } from "../cache/cache.module";
import { Warehouse } from "../../entities/Warehouse";
import { RoleWarehousePreset } from "../../entities/RoleWarehousePreset";
import { RoleVendorPreset } from "../../entities/RoleVendorPreset";
import { System } from "../../entities/System";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Status,
      Theme,
      UserPermissions,
      UserLocations,
      UserWarehouses,
      UserVendors,
      AppModule,
      Action,
      AccessKey,
      Location,
      UserAuditTrail,
      UserLoginSession,
      Warehouse,
      Vendor,
      RoleWarehousePreset,
      RoleVendorPreset,
      System,
    ]),
    SSEModule,
    CacheInvalidationModule,
  ],
  controllers: [
    UsersController,
    UserAccessKeyController,
    UserLocationsController,
    UserWarehousesController,
  ],
  providers: [
    UsersService,
    UserAuditTrailCreateService,
    EmailService,
    FrontendUrlUtil,
    UserLocationsService,
    UserWarehousesService,
    UserAccessKeyService,
    JwtService,
    UserSessionService,
    UserPermissionsService,
  ],
  exports: [
    UsersService,
    UserLocationsService,
    UserWarehousesService,
    UserAccessKeyService,
    UserSessionService,
    UserPermissionsService,
    UserAuditTrailCreateService,
  ],
})
export class UsersModule { }
