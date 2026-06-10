import { Module } from "@nestjs/common";

import { TypeOrmModule } from "@nestjs/typeorm";

import { ApprovalStagesList } from "src/entities/ApprovalStagesList";

import { ApprovalLogsController } from "./controller/approval-logs.controller";

import { ApprovalLogsService } from "./services/approval-logs.service";

import { UserPermissions } from "src/entities/UserPermissions";

import { Action } from "src/entities/Action";

import { Module as AppModule } from "src/entities/Module";

import { UsersModule } from "../users/users.module";

import { SSEModule } from "../sse/sse.module";
import { ApprovalMatrix } from "src/entities/ApprovalMatrix";
import { ApprovalMatrixDetails } from "src/entities/ApprovalMatrixDetails";
import { ApprovalMatrixLevels } from "src/entities/ApprovalMatrixLevels";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalStagesList,
      UserPermissions,
      AppModule,
      Action,
      ApprovalMatrix,
      ApprovalMatrixDetails,
      ApprovalMatrixLevels,
    ]),

    UsersModule,

    SSEModule,
  ],

  controllers: [ApprovalLogsController],

  providers: [ApprovalLogsService],

  exports: [ApprovalLogsService],
})
export class ApprovalLogsModule {}
