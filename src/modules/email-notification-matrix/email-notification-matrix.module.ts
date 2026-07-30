import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmailNotificationMatrix } from "../../entities/EmailNotificationMatrix";
import { EmailNotificationMatrixDetails } from "../../entities/EmailNotificationMatrixDetails";
import { EmailNotificationMatrixRecipients } from "../../entities/EmailNotificationMatrixRecipients";

import { EmailNotificationMatrixController } from "./controllers/email-notification-matrix.controller";
import { EmailNotificationMatrixService } from "./services/email-notification-matrix.service";

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
      EmailNotificationMatrix,
      EmailNotificationMatrixDetails,
      EmailNotificationMatrixRecipients,

      UserPermissions,
      AppModule,
      Action,
      ActionLog,
    ]),

    UsersModule,
    SSEModule,
  ],

  controllers: [EmailNotificationMatrixController],

  providers: [
    EmailNotificationMatrixService,
    ResponseMapperService,
    ActionLogsService,
  ],

  exports: [EmailNotificationMatrixService],
})
export class EmailNotificationMatrixModule {
  constructor() {
    logger.info("✅ EmailNotificationMatrixModule initialized");
  }
}
