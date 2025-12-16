import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserAuditTrailService } from "../../services/user-audit-trail.service";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { UserAuditTrailController } from "../../controllers/user-audit-trail.controller";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    SSEModule,
  ],
  controllers: [UserAuditTrailController],
  providers: [UserAuditTrailService, UserAuditTrailCreateService],
  exports: [UserAuditTrailService, UserAuditTrailCreateService],
})
export class UserAuditTrailModule {}
