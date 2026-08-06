import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
import { Staff } from "src/entities/Staff";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffWarehousesService } from "src/modules/staff-warehouses/services/staff-warehouses.service";
import { StaffWarehousesController } from "src/modules/staff-warehouses/controllers/staff-warehouses.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { ActionsModule } from "../actions/actions.module";
import { User } from "src/entities/User";
import { Warehouse } from "src/entities/Warehouse";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffWarehouse,
      Staff,
      User,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Warehouse
    ]),
    UsersModule,
    SSEModule,
    ActionsModule
  ],
  controllers: [StaffWarehousesController],
  providers: [
    StaffWarehousesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffWarehousesService],
})
export class StaffWarehousesModule {}
