import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffVendorSalariesService } from "src/services/staff-vendor-salaries.service";
import { StaffVendorSalariesController } from "src/controllers/staff-vendor-salaries.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffVendorSalary,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [StaffVendorSalariesController],
  providers: [
    StaffVendorSalariesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffVendorSalariesService],
})
export class StaffVendorSalariesModule {}
