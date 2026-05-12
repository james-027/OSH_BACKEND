import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { AuditFormCategoryTypes } from "../../entities/AuditFormCategoryTypes";
import { AuditCategoryTypesController } from "./controllers/audit-category-types.controller";
import { AuditCategoryTypesService } from "./services/audit-category-types.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditFormCategoryTypes,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [AuditCategoryTypesController],
  providers: [
    AuditCategoryTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [AuditCategoryTypesService],
})
export class AuditCategoryTypesModule {}
