import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LocationsController } from "./controllers/locations.controller";
import { LocationsService } from "./services/locations.service";
import { Location } from "../../entities/Location";
import { LocationTypesService } from "./services/location-types.service";
import { LocationType } from "../../entities/LocationType";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UsersModule } from "../users/users.module";
import { LocationTypesController } from "src/modules/locations/controllers/location-types.controller";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { SSEModule } from "../sse/sse.module";
import { UserLocations } from "src/entities/UserLocations";
import { RoleLocationPreset } from "src/entities/RoleLocationPreset";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { LocationHurdlesController } from "src/modules/locations/controllers/location-hurdles.controller";
import { LocationHurdleCategoriesController } from "src/modules/locations/controllers/location-hurdle-categories.controller";
import { LocationHurdlesService } from "./services/location-hurdles.service";
import { LocationHurdleCategoriesService } from "./services/location-hurdle-categories.service";
import { LocationHurdle } from "src/entities/LocationHurdle";
import { LocationHurdleCategory } from "src/entities/LocationHurdleCategory";
import { WarehouseHurdle } from "src/entities/WarehouseHurdle";
import { Warehouse } from "src/entities/Warehouse";
import { ItemCategoriesService } from "src/modules/items/services/item-categories.service";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { SyncLog } from "src/entities/syncLog";
import { ItemCategory } from "src/entities/ItemCategory";
import { ActionLog } from "src/entities/ActionLog";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Location,
      LocationType,
      LocationHurdle,
      LocationHurdleCategory,
      WarehouseHurdle,
      Warehouse,
      User,
      Status,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
      UserLocations,
      RoleLocationPreset,
      TransactionSequence,
      SyncLog,
      ItemCategory,
      ActionLog,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [
    LocationsController,
    LocationTypesController,
    LocationHurdlesController,
    LocationHurdleCategoriesController,
  ],
  providers: [
    LocationsService,
    LocationTypesService,
    LocationHurdlesService,
    LocationHurdleCategoriesService,
    UserAuditTrailCreateService,
    CommonUtilitiesService,
    ItemCategoriesService,
    ActionLogsService,
  ],
  exports: [
    LocationsService,
    LocationTypesService,
    LocationHurdlesService,
    LocationHurdleCategoriesService,
  ],
})
export class LocationsModule {}
