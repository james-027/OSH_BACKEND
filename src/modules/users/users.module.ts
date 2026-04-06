import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "../../services/users.service";
import { User } from "../../entities/User";
import { Role } from "../../entities/Role";
import { Status } from "../../entities/Status";
import { Theme } from "../../entities/Theme";
import { UserPermissions } from "../../entities/UserPermissions";
import { UserLocations } from "../../entities/UserLocations";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { AccessKey } from "../../entities/AccessKey";
import { Location } from "../../entities/Location";
import { UsersController } from "../../controllers/users.controller";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { EmailService } from "../../services/email.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserLocationsService } from "src/services/user-locations.service";
import { UserAccessKeyService } from "src/services/user-access-key.service";
import { UserLoginSession } from "src/entities/UserLoginSession";
import { JwtService } from "@nestjs/jwt";
import { UserSessionService } from "src/services/user-session.service";
import { UserPermissionsService } from "src/services/user-permissions.service";
import { UserAccessKeyController } from "src/controllers/user-access-key.controller";
import { SSEModule } from "../sse/sse.module";
import { FrontendUrlUtil } from "src/utils/frontend-url.util";
import { CacheInvalidationModule } from "../cache/cache.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Status,
      Theme,
      UserPermissions,
      UserLocations,
      AppModule,
      Action,
      AccessKey,
      Location,
      UserAuditTrail,
      UserLoginSession,
    ]),
    SSEModule,
    CacheInvalidationModule,
  ],
  controllers: [UsersController, UserAccessKeyController],
  providers: [
    UsersService,
    UserAuditTrailCreateService,
    EmailService,
    FrontendUrlUtil,
    UserLocationsService,
    UserAccessKeyService,
    JwtService,
    UserSessionService,
    UserPermissionsService,
  ],
  exports: [
    UsersService,
    UserLocationsService,
    UserAccessKeyService,
    UserSessionService,
    UserPermissionsService,
    UserAuditTrailCreateService,
  ],
})
export class UsersModule {}
