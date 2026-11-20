import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SalesTerritory } from "../../entities/SalesTerritory";
import { Status } from "../../entities/Status";
import { User } from "../../entities/User";
import { AccessKey } from "../../entities/AccessKey";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { SalesTerritoriesController } from "./controllers/sales-territories.controller";
import { SalesTerritoriesService } from "./services/sales-territories.service";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesTerritory,
      Status,
      User,
      AccessKey,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [SalesTerritoriesController],
  providers: [
    SalesTerritoriesService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [SalesTerritoriesService],
})
export class SalesTerritoriesModule {}
