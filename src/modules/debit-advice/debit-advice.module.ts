import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DebitAdvice_header } from "../../entities/DebitAdviceHeader";
import { DebitAdviceLine } from "../../entities/DebitAdviceItems";
import { DebitAdviceController } from "./controllers/debit-advice.controller";
import { DebitAdviceService } from "./services/debit-advice.service";
import { OSHJVService } from "./services/jv-creation.service";
import { UsersModule } from "../users/users.module";
import { UserPermissions } from "src/entities/UserPermissions";
import { SSEModule } from "../sse/sse.module";
import { Action } from "../../entities/Action";
import { Module as AppModule } from "../../entities/Module";
// import { UserAuditTrailCreateService } from "../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { CommonUtilitiesService } from "../../services/common-utilities.service";
import { TransactionSequence } from "../../entities/TransactionSequence";
import { DebitAdviceGLItems } from "src/entities/DebitAdviceGLItems";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { ActionLog } from "src/entities/ActionLog";
import { DocumentPostingLog } from "src/entities/DocumentPostingLog";
import { TransactionAttachment } from "src/entities/TransactionAttachment";
import { ApprovalMatrixService } from "../approval-matrix/services/approval-matrix.service";
import { ApprovalMatrix } from "../../entities/ApprovalMatrix";
import { ApprovalMatrixDetails } from "../../entities/ApprovalMatrixDetails";
import { ApprovalMatrixLevels } from "../../entities/ApprovalMatrixLevels";
import { ApprovalStagesList } from "src/entities/ApprovalStagesList";
import { ApprovalLogsService } from "../approval-logs/services/approval-logs.service";
import { EmailNotificationMatrixModule } from "../email-notification-matrix/email-notification-matrix.module";
import { EmailQueueModule } from "../email-queue/email-queue.module";
// This is the main module file for the debit advice feature. It imports the necessary entities, controllers, and services related to debit advice.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebitAdvice_header,
      DebitAdviceLine, // Don't forget to include the line item entity
      DebitAdviceGLItems,
      UserPermissions,
      AppModule,
      Action,
      TransactionSequence,
      ActionLog,
      DocumentPostingLog,
      TransactionAttachment,
      ApprovalMatrix,
      ApprovalMatrixDetails,
      ApprovalMatrixLevels,
      ApprovalStagesList,
      
    ]),
    UsersModule,
    SSEModule,
    EmailNotificationMatrixModule,
    EmailQueueModule
  ],

  controllers: [DebitAdviceController],
  providers: [
    DebitAdviceService,
    CommonUtilitiesService,
    ResponseMapperService,
    ActionLogsService,
    OSHJVService,
    ApprovalMatrixService,
    ApprovalLogsService,
  ],
  exports: [DebitAdviceService, OSHJVService],
})
export class DebitAdviceModule {}
