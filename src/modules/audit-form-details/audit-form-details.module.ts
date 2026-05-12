import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { AuditFormDetails } from "../../entities/AuditFormDetails";
import { Employee } from "../../entities/Employee";
import { AuditFormDetailsController } from "./controllers/audit-form-details.controller";
import { AuditFormDetailsService } from "./services/audit-form-details.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditFormDetails,
      UserAuditTrail,
      Employee,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [AuditFormDetailsController],
  providers: [
    AuditFormDetailsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [AuditFormDetailsService],
})
export class AuditFormDetailsModule {}
