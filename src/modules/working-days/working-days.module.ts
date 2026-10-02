import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { WorkingDaysController } from "./controllers/working-days.controller";
import { WorkingDaysService } from "./services/working-days.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { WorkingDay } from "src/entities/WorkingDay";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkingDay,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [WorkingDaysController],
  providers: [
    WorkingDaysService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [WorkingDaysService],
})
export class WorkingDaysModule {}
