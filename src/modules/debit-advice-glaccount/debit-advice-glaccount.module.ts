import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DebitAdviceGLAccounts } from "src/entities/DebitAdviceGLAccounts";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

import { DebitAdviceGlAccountController } from "./controllers/debit-advice-glaccount.controller";
import { DebitAdviceGlAccountService } from "./services/debit-advice-glaccount.service";

import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

import { Status } from "src/entities/Status";
import { User } from "src/entities/User";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebitAdviceGLAccounts,
      UserPermissions,
      PermissionModule,
      Action,
      Status,
      User,
    ]),
    UsersModule,
    SSEModule,
  ],

  controllers: [DebitAdviceGlAccountController],

  providers: [
    DebitAdviceGlAccountService,
    ResponseMapperService,
  ],

  exports: [DebitAdviceGlAccountService],
})
export class DebitAdviceGlAccountModule {}