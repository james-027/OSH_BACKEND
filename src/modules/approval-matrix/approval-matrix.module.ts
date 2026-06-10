import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ApprovalMatrix } from "../../entities/ApprovalMatrix";
import { ApprovalMatrixDetails } from "../../entities/ApprovalMatrixDetails";
import { ApprovalMatrixLevels } from "../../entities/ApprovalMatrixLevels";

import { ApprovalMatrixController } from "./controllers/approval-matrix.controller";
import { ApprovalMatrixService } from "./services/approval-matrix.service";

import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

import { UserPermissions } from "../../entities/UserPermissions";
import { Action } from "../../entities/Action";
import { Module as AppModule } from "../../entities/Module";
import { ActionLog } from "../../entities/ActionLog";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { ActionLogsService } from "../actions/services/action-logs.service";
import logger from "src/config/logger";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalMatrix,
      ApprovalMatrixDetails,
      ApprovalMatrixLevels,

      UserPermissions,
      AppModule,
      Action,
      ActionLog,
    ]),

    UsersModule,
    SSEModule,
  ],

  controllers: [ApprovalMatrixController],

  providers: [ApprovalMatrixService, ResponseMapperService, ActionLogsService],

  exports: [ApprovalMatrixService],
})
export class ApprovalMatrixModule {
  constructor() {
    logger.info("✅ ApprovalMatrixModule initialized");
  }
}
