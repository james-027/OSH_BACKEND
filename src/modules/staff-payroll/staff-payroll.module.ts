import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { StaffPayrollController } from "./controllers/staff-payroll.controller";
import { StaffPayrollService } from "./services/staff-payroll.service";
import { PayrollComputationService } from "./services/payroll-computation.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { PayrollHeader } from "src/entities/PayrollHeader";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { ScheduleHeader } from "src/entities/ScheduleHeader";
import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { TimeKeepingConfig } from "src/entities/TimeKeepingConfig";
import { SyncLog } from "src/entities/syncLog";
import { LogsComputationService } from "src/schedulers/logs-computation.scheduler";
import { PayrollComputationScheduler } from "src/schedulers/payroll-computation.scheduler";
import { PayrollDetails } from "src/entities/PayrollDetails";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { StaffSalary } from "src/entities/StaffSalary";
import { ActionsModule } from "../actions/actions.module";
import { SssConfigs } from "src/entities/SssConfig";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";



@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollHeader,
      PayrollDetails,
      StaffWarehouse,
      ScheduleDetail,
      ScheduleHeader,
      TimeKeepingConfig,
      StaffSalary,
      SssConfigs,
      StaffVendorSalary,
      UserAuditTrail,
      UserPermissions,
      TransactionSequence,
      AppModule,
      Action,
      Location,
      SyncLog
    ]),
    UsersModule,
    SSEModule,
    ActionsModule,

  ],
  controllers: [StaffPayrollController],
  providers: [
    StaffPayrollService,
    UserAuditTrailCreateService,
    LogsComputationService,
    PayrollComputationScheduler,
    ResponseMapperService,
    PayrollComputationService,
    CommonUtilitiesService
  ],
  exports: [StaffPayrollService],
})
export class StaffPayrollModule {}
