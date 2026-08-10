import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmailQueue } from "../../entities/EmailQueue";

import { UserPermissions } from "../../entities/UserPermissions";
import { Action } from "../../entities/Action";
import { Module as AppModule } from "../../entities/Module";
import { ActionLog } from "../../entities/ActionLog";

import { EmailQueueController } from "./controllers/email-queue.controller";
import { EmailQueueService } from "./services/email-queue.service";

import { EmailNotificationMatrixModule } from "../email-notification-matrix/email-notification-matrix.module";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { ActionLogsService } from "../actions/services/action-logs.service";
import { EmailQueueScheduler } from "src/schedulers/email-queue.scheduler";
import logger from "src/config/logger";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailQueue,

      UserPermissions,
      AppModule,
      Action,
      ActionLog,
    ]),

    UsersModule,
    SSEModule,
    EmailNotificationMatrixModule,
  ],

  controllers: [EmailQueueController],

  providers: [
    EmailQueueService,
    EmailQueueScheduler,
    ResponseMapperService,
    ActionLogsService,
  ],

  exports: [EmailQueueService],
})
export class EmailQueueModule {
  constructor() {
    logger.info("✅ EmailQueueModule initialized");
  }
}
