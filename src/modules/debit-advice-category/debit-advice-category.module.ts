import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DebitAdviceCategory } from "../../entities/DebitAdviceCategory";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

import { DebitAdviceCategoryController } from "./controllers/debit-advice-category.controller";
import { DebitAdviceCategoryService } from "./services/debit-advice-category.service";

import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { SSEModule } from "../sse/sse.module"; //
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebitAdviceCategory,
      UserPermissions,
      PermissionModule,
      Action
    ]),
    UsersModule,
    SSEModule
  ],

  controllers: [DebitAdviceCategoryController],

  providers: [
    DebitAdviceCategoryService,
    ResponseMapperService,
  ],

  exports: [DebitAdviceCategoryService],
})
export class DebitAdviceCategoryModule { }