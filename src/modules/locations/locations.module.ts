import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LocationsController } from "../../controllers/locations.controller";
import { LocationsService } from "../../services/locations.service";
import { Location } from "../../entities/Location";
import { LocationTypesService } from "../../services/location-types.service";
import { LocationType } from "../../entities/LocationType";
import { UserAuditTrailCreateService } from "src/services/user-audit-trail-create.service";
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UsersModule } from "../users/users.module";
import { LocationTypesController } from "src/controllers/location-types.controller";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { SSEModule } from "../sse/sse.module";
import { UserLocations } from "src/entities/UserLocations";
import { RoleLocationPreset } from "src/entities/RoleLocationPreset";
import { TransactionSequence } from "src/entities/TransactionSequence";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Location,
      LocationType,
      User,
      Status,
      UserPermissions,
      AppModule,
      Action,
      UserAuditTrail,
      UserLocations,
      RoleLocationPreset,
      TransactionSequence,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [LocationsController, LocationTypesController],
  providers: [
    LocationsService,
    LocationTypesService,
    UserAuditTrailCreateService,
    CommonUtilitiesService,
  ],
  exports: [LocationsService, LocationTypesService],
})
export class LocationsModule {}
