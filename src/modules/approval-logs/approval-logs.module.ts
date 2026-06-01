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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalStagesList,
      UserPermissions,
      AppModule,
      Action,
    ]),

    UsersModule,

    SSEModule,
  ],

  controllers: [ApprovalLogsController],

  providers: [ApprovalLogsService],

  exports: [ApprovalLogsService],
})
export class ApprovalLogsModule {}
