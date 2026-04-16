import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffWarehouse } from "src/entities/StaffWarehouse";
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffWarehouse,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
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
