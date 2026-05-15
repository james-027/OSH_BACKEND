import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DebitAdviceGlAccount } from "src/entities/DebitAdviceGLAccount";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

import { DebitAdviceGlAccountController } from "./controllers/debit-advice-glaccount.controller";
import { DebitAdviceGlAccountService } from "./services/debit-advice-glaccount.service";

import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module"; //
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebitAdviceGlAccount,
      UserPermissions,
      PermissionModule,
      Action,
    ]),
    UsersModule,
    SSEModule
  ],

  controllers: [DebitAdviceGlAccountController],

  providers: [
    DebitAdviceGlAccountService,
    ResponseMapperService,
  ],

  exports: [DebitAdviceGlAccountService],
})
export class DebitAdviceGlAccountModule { }