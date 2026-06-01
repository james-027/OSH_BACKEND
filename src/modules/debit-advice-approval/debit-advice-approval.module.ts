import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DebitAdviceApprovalController } from "./controllers/debit-advice-approval.controller";

import { ApprovalStagesListService } from "./services/debit-advice-approval.service";

import { ApprovalStagesList } from "src/entities/ApprovalStagesList";
import { DebitAdvice_header } from "src/entities/DebitAdviceHeader";
import { Status } from "src/entities/Status";
import { User } from "src/entities/User";

import { UserPermissions } from "src/entities/UserPermissions";
import { UserAuditTrail } from "src/entities/UserAuditTrail";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";

import { TransactionSequence } from "src/entities/TransactionSequence";

import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";

import { UsersModule } from "../users/users.module";
import { StatusModule } from "../status/status.module";
import { ActionsModule } from "../actions/actions.module";
import { SSEModule } from "../sse/sse.module";
import { CacheInvalidationModule } from "../cache/cache.module";

import { CommonUtilitiesService } from "src/services/common-utilities.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalStagesList,
      DebitAdvice_header,
      Status,
      User,
      UserPermissions,
      UserAuditTrail,
      AppModule,
      Action,
      TransactionSequence,
    ]),

    UsersModule,
    StatusModule,
    ActionsModule,
    SSEModule,
    CacheInvalidationModule,
  ],

  controllers: [
    DebitAdviceApprovalController,
  ],

  providers: [
    ApprovalStagesListService,
    UserAuditTrailCreateService,
    CommonUtilitiesService,
  ],

  exports: [
    ApprovalStagesListService,
  ],
})
export class DebitAdviceApprovalModule {}