import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WarehousesController } from "../../controllers/warehouses.controller";
import { WarehouseTypesController } from "../../controllers/warehouse-types.controller";
import { WarehouseRatesController } from "../../controllers/warehouse-rates.controller";
import { WarehouseHurdlesController } from "../../controllers/warehouse-hurdles.controller";
import { WarehouseHurdleCategoriesController } from "../../controllers/warehouse-hurdle-categories.controller";
import { WarehouseEmployeesController } from "../../controllers/warehouse-employees.controller";
import { WarehouseDwhController } from "../../controllers/warehouse-dwh.controller";
import { WarehousesService } from "../../services/warehouses.service";
import { WarehouseTypesService } from "../../services/warehouse-types.service";
import { WarehouseRatesService } from "../../services/warehouse-rates.service";
import { WarehouseHurdlesService } from "../../services/warehouse-hurdles.service";
import { WarehouseHurdleCategoriesService } from "../../services/warehouse-hurdle-categories.service";
import { WarehouseEmployeesService } from "../../services/warehouse-employees.service";
import { WarehouseDwhService } from "../../services/warehouse-dwh.service";
import { WarehouseType } from "../../entities/WarehouseType";
import { WarehouseRate } from "../../entities/WarehouseRate";
import { WarehouseHurdle } from "../../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../../entities/WarehouseHurdleCategory";
import { WarehouseEmployee } from "../../entities/WarehouseEmployee";
import { WarehouseDwhLog } from "../../entities/WarehouseDwhLog";
import { Warehouse } from "../../entities/Warehouse";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { User } from "src/entities/User";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UsersModule } from "../users/users.module";
import { StatusModule } from "../status/status.module";
import { PositionsModule } from "../positions/positions.module";
import { LocationsModule } from "../locations/locations.module";
import { EmployeesModule } from "../employees/employees.module";
import { ActionsModule } from "../actions/actions.module";
import { ItemsModule } from "../items/items.module";
import { WarehouseRequirementsModule } from "../warehouse-requirements/warehouse-requirements.module";
import { WarehouseRequirementsController } from "../../controllers/warehouse-requirements.controller";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { SSEModule } from "../sse/sse.module";
import { TransactionSequence } from "src/entities/TransactionSequence";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Warehouse,
      WarehouseType,
      WarehouseRate,
      WarehouseHurdle,
      WarehouseHurdleCategory,
      WarehouseEmployee,
      WarehouseDwhLog,
      User,
      UserPermissions,
      AppModule,
      UserAuditTrail,
      Action,
      TransactionSequence,
    ]),
    UsersModule,
    StatusModule,
    PositionsModule,
    LocationsModule,
    EmployeesModule,
    ActionsModule,
    ItemsModule,
    WarehouseRequirementsModule,
    SSEModule,
  ],
  controllers: [
    WarehousesController,
    WarehouseRequirementsController,
    WarehouseTypesController,
    WarehouseRatesController,
    WarehouseHurdlesController,
    WarehouseHurdleCategoriesController,
    WarehouseEmployeesController,
    WarehouseDwhController,
  ],
  providers: [
    WarehousesService,
    WarehouseTypesService,
    WarehouseRatesService,
    WarehouseHurdlesService,
    WarehouseHurdleCategoriesService,
    WarehouseEmployeesService,
    WarehouseDwhService,
    UserAuditTrailCreateService,
    UserAuditTrailCreateService,
    CommonUtilitiesService,
  ],
  exports: [
    WarehousesService,
    WarehouseTypesService,
    WarehouseRatesService,
    WarehouseHurdlesService,
    WarehouseHurdleCategoriesService,
    WarehouseEmployeesService,
    WarehouseDwhService,
  ],
})
export class WarehousesModule {}
