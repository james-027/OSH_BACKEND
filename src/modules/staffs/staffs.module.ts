import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { Staff } from "../../entities/Staff";
import { StaffsController } from "./controllers/staffs.controller";
import { StaffsService } from "./services/staffs.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { AccessKey } from "src/entities/AccessKey";
import { Position } from "src/entities/Position";
import { Vendor } from "src/entities/Vendor";
import { Status } from "src/entities/Status";
import { StaffBrand } from "src/entities/StaffBrand";
import { StaffCategoryType } from "src/entities/StaffCategoryType";
import { StaffVendorSalary } from "src/entities/StaffVendorSalary";
import { Brand } from "src/entities/Brand";
import { CategoryType } from "src/entities/CategoryType";
import { ActionsModule } from "../actions/actions.module";
import { StaffHistory } from "src/entities/StaffHistory";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { StaffSalary } from "src/entities/StaffSalary";
import { StaffTraining } from "src/entities/StaffTrainings";
import { Training } from "src/entities/Training";
import { StaffTransfers } from "src/entities/StaffTransfers";


@Module({
  imports: [
    TypeOrmModule.forFeature([
      Staff,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
      Position,
      Vendor,
      StaffBrand,
      StaffCategoryType,
      StaffVendorSalary,
      CategoryType,
      Brand,
      AccessKey,
      Status,
      StaffHistory,
      TransactionSequence,
      StaffWarehouse,
      StaffSalary,
      StaffTraining,
      Training,
      StaffTransfers
    ]),
    UsersModule,
    SSEModule,
    ActionsModule
  ],
  controllers: [StaffsController],
  providers: [
    StaffsService,
    UserAuditTrailCreateService,
    ResponseMapperService,
    CommonUtilitiesService
  ],
  exports: [StaffsService],
})
export class StaffsModule {}
