import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { StaffSalary } from "src/entities/StaffSalary";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffVendorSalariesService } from "src/modules/staff-vendor-salaries/services/staff-vendor-salaries.service";
import { StaffVendorSalariesController } from "src/modules/staff-vendor-salaries/controllers/staff-vendor-salaries.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { ActionsModule } from "../actions/actions.module";
import { Staff } from "src/entities/Staff";
import { Vendor } from "src/entities/Vendor";
import { Location } from "src/entities/Location";
import { SssConfigs } from "src/entities/SssConfig";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffVendorSalary,
      StaffSalary,
      Staff,
      Vendor,
      Location,
      SssConfigs,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
    ActionsModule
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
