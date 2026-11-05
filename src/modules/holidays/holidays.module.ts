import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CalendarHoliday } from "src/entities/CalendarHoliday";
import { WorkingDay } from "src/entities/WorkingDay";
import { HolidaysService } from "./services/holidays.service";
import { HolidaysController } from "src/modules/holidays/controllers/holidays.controller";
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
      CalendarHoliday,
      WorkingDay,
      User,
      Status,
      Role,
      Theme,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
    ]),
    UsersModule,
    SSEModule,
  ],
  providers: [
    HolidaysService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  controllers: [HolidaysController],
  exports: [HolidaysService],
})
export class HolidaysModule {}
