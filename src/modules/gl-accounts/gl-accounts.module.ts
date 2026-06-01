import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { GLAccounts } from "src/entities/GLAccounts";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

import { GlAccountsController } from "./controllers/gl-accounts.controller";
import { GlAccountsService } from "./services/gl-accounts.service";
import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module";

import { Status } from "src/entities/Status";
import { User } from "src/entities/User";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GLAccounts,
      UserPermissions,
      PermissionModule,
      Action,
      Status,
      User,
    ]),
    UsersModule,
    SSEModule,
  ],

  controllers: [GlAccountsController],

  providers: [GlAccountsService, ResponseMapperService],

  exports: [GlAccountsService],
})
export class GlAccountsModule {}
