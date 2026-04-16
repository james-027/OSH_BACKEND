import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemDocumentationsController } from "./controllers/system-documentations.controller";
import { SystemDocumentationsService } from "./services/system-documentations.service";
import { SystemDocumentation } from "../../entities/SystemDocumentation";
import { System } from "../../entities/System";
import { Status } from "../../entities/Status";
import { User } from "../../entities/User";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { SSEModule } from "../sse/sse.module";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemDocumentation,
      System,
      Status,
      User,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    SSEModule,
  ],
  controllers: [SystemDocumentationsController],
  providers: [SystemDocumentationsService, UserAuditTrailCreateService],
  exports: [SystemDocumentationsService],
})
export class SystemDocumentationsModule {}
