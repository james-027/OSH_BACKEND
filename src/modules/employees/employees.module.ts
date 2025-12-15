import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmployeesService } from "../../services/employees.service";
import { Employee } from "../../entities/Employee";
import { EmployeesController } from "../../controllers/employees.controller";
import { UserAuditTrailCreateService } from "../../services/user-audit-trail-create.service";
import { EmployeeLocationsService } from "../../services/employee-locations.service";
import { PositionsService } from "../../services/positions.service";
import { UsersModule } from "../users/users.module";
import { LocationsModule } from "../locations/locations.module";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { EmployeeLocation } from "../../entities/EmployeeLocation";
import { Location } from "src/entities/Location";
import { Position } from "src/entities/Position";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      UserAuditTrail,
      EmployeeLocation,
      Location,
      Position,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    LocationsModule,
    SSEModule,
  ],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    UserAuditTrailCreateService,
    EmployeeLocationsService,
    PositionsService,
    CommonUtilitiesService,
  ],
  exports: [EmployeesService, EmployeeLocationsService],
})
export class EmployeesModule {}
