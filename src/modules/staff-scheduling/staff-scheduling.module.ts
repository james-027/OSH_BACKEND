import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleDetail } from "src/entities/ScheduleDetails";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffSchedulingService} from "src/modules/staff-scheduling/services/staff-scheduling.service";
import { StaffSchedulingController } from "src/modules/staff-scheduling/controllers/staff-scheduling.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { Staff } from "src/entities/Staff";
import { Warehouse } from "src/entities/Warehouse";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { StaffHistory } from "src/entities/StaffHistory";
import { Vendor } from "src/entities/Vendor";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { ActionsModule } from "../actions/actions.module";
import { Status } from "src/entities/Status";
import { ScheduleHeader } from "src/entities/ScheduleHeader";


@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleDetail,
      ScheduleHeader,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      StaffWarehouse,
      Warehouse,
      Action,
      Staff,
      Vendor,
      TransactionSequence,
      StaffHistory,
      Status
    ]),
    UsersModule,
    SSEModule,
    ActionsModule
  ],
  controllers: [StaffSchedulingController],
  providers: [
    StaffSchedulingService,
    UserAuditTrailCreateService,
    ResponseMapperService,
     CommonUtilitiesService,
  ],
  exports: [StaffSchedulingService],
})
export class StaffSchedulingModule {}
