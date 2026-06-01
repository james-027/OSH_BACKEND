import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BrandGroup } from "src/entities/BrandGroup";
import { BrandGroupsService } from "./services/brand-groups.service";
import { BrandGroupsController } from "src/modules/brands/controllers/brand-groups.controller";
import { UsersService } from "src/modules/users/services/users.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { Role } from "src/entities/Role";
import { Theme } from "src/entities/Theme";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { UsersModule } from "../users/users.module";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
     BrandGroup,
      User,
      Status,
      Role,
      Theme,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail
    ]),
    UsersModule,
    SSEModule,
  ],
  providers: [BrandGroupsService,  
        UserAuditTrailCreateService,
      ResponseMapperService,],
  controllers: [BrandGroupsController],
  exports: [BrandGroupsService],
})
export class BrandGroupModule {}