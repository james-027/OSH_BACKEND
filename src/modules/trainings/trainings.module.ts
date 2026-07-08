import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { UserAuditTrail } from "../../entities/UserAuditTrail";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as AppModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Location } from "../../entities/Location";
import { TrainingsController } from "./controllers/trainings.controller";
import { TrainingService } from "./services/trainings.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";
import { Training } from "src/entities/Training";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Training,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
      Location,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [TrainingsController],
  providers: [
    TrainingService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [TrainingService],
})
export class TrainingsModule {}
