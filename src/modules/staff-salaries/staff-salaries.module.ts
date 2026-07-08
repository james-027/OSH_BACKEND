import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffSalary } from "src/entities/StaffSalary";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffSalariesService } from "src/modules/staff-salaries/services/staff-salaries.service";
import { StaffSalariesController } from "src/modules/staff-salaries/controllers/staff-salaries.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffSalary,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [StaffSalariesController],
  providers: [
    StaffSalariesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffSalariesService],
})
export class StaffSalariesModule {}
