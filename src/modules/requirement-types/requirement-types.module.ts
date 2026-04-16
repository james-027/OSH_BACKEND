import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { RequirementType } from "../../entities/RequirementType";
import { RequirementTypesController } from "./controllers/requirement-types.controller";
import { RequirementTypesService } from "./services/requirement-types.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RequirementType,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [RequirementTypesController],
  providers: [
    RequirementTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [RequirementTypesService],
})
export class RequirementTypesModule {}
