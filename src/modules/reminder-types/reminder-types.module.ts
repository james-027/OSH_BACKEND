import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { ReminderType } from "../../entities/ReminderType";
import { ReminderTypesController } from "./controller/reminder-types.controller";
import { ReminderTypesService } from "./services/reminder-types.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReminderType,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [ReminderTypesController],
  providers: [
    ReminderTypesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [ReminderTypesService],
})
export class ReminderTypesModule {}
