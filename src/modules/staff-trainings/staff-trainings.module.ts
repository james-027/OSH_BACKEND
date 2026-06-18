import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StaffTraining } from "src/entities/StaffTrainings";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { UserPermissions } from "src/entities/UserPermissions";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { StaffTrainingService } from "src/modules/staff-trainings/services/staff-trainings.service";
import { StaffTrainingsController } from "src/modules/staff-trainings/controllers/staff-training.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffTraining,
      UserAuditTrail,
      UserPermissions,
      AppModule,
      Action,
    ]),
    UsersModule,
    SSEModule,
  ],
  controllers: [StaffTrainingsController],
  providers: [
    StaffTrainingService,
    UserAuditTrailCreateService,
    ResponseMapperService,
  ],
  exports: [StaffTrainingService],
})
export class StaffTrainingModule {}
