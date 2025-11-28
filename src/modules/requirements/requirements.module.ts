import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Requirement } from "../../entities/Requirement";
import { RequirementsController } from "../../controllers/requirements.controller";
import { RequirementsService } from "../../services/requirements.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { RenewalType } from "../../entities/RenewalType";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Requirement,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      RenewalType,
    ]),
    UsersModule,
  ],
  controllers: [RequirementsController],
  providers: [
    RequirementsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [RequirementsService],
})
export class RequirementsModule {}
