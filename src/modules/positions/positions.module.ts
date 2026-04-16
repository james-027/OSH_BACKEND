import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PositionsController } from "./controllers/positions.controller";
import { PositionsService } from "./services/positions.service";
import { Position } from "../../entities/Position";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "src/entities/Action";
import { Location } from "src/entities/Location";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Position,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [PositionsController],
  providers: [PositionsService, UserAuditTrailCreateService],
  exports: [PositionsService],
})
export class PositionsModule {}
