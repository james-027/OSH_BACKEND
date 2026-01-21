import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ItemsController } from "../../controllers/items.controller";
import { ItemCategoriesController } from "../../controllers/item-categories.controller";
import { ItemsDwhController } from "../../controllers/items-dwh.controller";
import { ItemsService } from "../../services/items.service";
import { ItemCategoriesService } from "../../services/item-categories.service";
import { ItemsDwhService } from "../../services/items-dwh.service";
import { Item } from "../../entities/Item";
import { ItemCategory } from "../../entities/ItemCategory";
import { DwhLog } from "../../entities/dwhLog";
import { UsersService } from "src/services/users.service";
import { Role } from "src/entities/Role";
import { Status } from "src/entities/Status";
import { Theme } from "src/entities/Theme";
import { UserPermissions } from "src/entities/UserPermissions";
import { UserLocations } from "src/entities/UserLocations";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { AccessKey } from "src/entities/AccessKey";
import { Location } from "src/entities/Location";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { EmailService } from "src/services/email.service";
import { User } from "src/entities/User";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { EmployeesService } from "src/services/employees.service";
import { Employee } from "src/entities/Employee";
import { EmployeeLocationsService } from "src/services/employee-locations.service";
import { PositionsService } from "src/services/positions.service";
import { Position } from "src/entities/Position";
import { EmployeeLocation } from "src/entities/EmployeeLocation";
import { LocationsModule } from "../locations/locations.module";
import { SSEModule } from "../sse/sse.module";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { FrontendUrlUtil } from "src/utils/frontend-url.util";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      ItemCategory,
      DwhLog,
      Role,
      Status,
      Theme,
      UserPermissions,
      UserLocations,
      AppModule,
      Action,
      AccessKey,
      Location,
      User,
      UserAuditTrail,
      Employee,
      Position,
      EmployeeLocation,
      TransactionSequence,
    ]),
    LocationsModule,
    SSEModule,
  ],
  controllers: [ItemsController, ItemCategoriesController, ItemsDwhController],
  providers: [
    ItemsService,
    ItemCategoriesService,
    ItemsDwhService,
    UsersService,
    UserAuditTrailCreateService,
    EmailService,
    FrontendUrlUtil,
    EmployeesService,
    EmployeeLocationsService,
    PositionsService,
    CommonUtilitiesService,
  ],
  exports: [ItemsService, ItemCategoriesService, ItemsDwhService],
})
export class ItemsModule {}
