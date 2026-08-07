import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EmailNotificationMatrix } from "../../entities/EmailNotificationMatrix";
import { EmailNotificationMatrixDetails } from "../../entities/EmailNotificationMatrixDetails";
import { EmailNotificationMatrixRecipients } from "../../entities/EmailNotificationMatrixRecipients";

import { EmailNotificationMatrixController } from "./controllers/email-notification-matrix.controller";
import { EmailNotificationMatrixService } from "./services/email-notification-matrix.service";
import { EmailNotificationSenderService } from "./services/email-notification-sender.service";
import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

import { UserPermissions } from "../../entities/UserPermissions";
import { Action } from "../../entities/Action";
import { Module as AppModule } from "../../entities/Module";
import { ActionLog } from "../../entities/ActionLog";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { ActionLogsService } from "../actions/services/action-logs.service";
import logger from "src/config/logger";
import { ApprovalStagesList } from "../../entities/ApprovalStagesList";
import { User } from "../../entities/User";
import { EmailNotificationMailService } from "./services/email-notification-mail.service";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";
import { EmailQueue } from "src/entities/EmailQueue";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailNotificationMatrix,
      EmailNotificationMatrixDetails,
      EmailNotificationMatrixRecipients,
      EmailQueue,
      ApprovalStagesList,
      User,
      DebitAdvice_header,
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
    EmailNotificationSenderService,
    EmailNotificationMailService,
    ResponseMapperService,
    ActionLogsService,
  ],

  exports: [
    EmailNotificationMatrixService,
    EmailNotificationSenderService,
    EmailNotificationMailService,
  ],
})
export class EmailNotificationMatrixModule {
  constructor() {
    logger.info("✅ EmailNotificationMatrixModule initialized");
  }
}
