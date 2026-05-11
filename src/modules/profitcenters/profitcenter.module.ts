import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Profitcenter } from "../../entities/Profitcenter";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

import { ProfitcenterController } from "./controllers/profitcenter.controller";
import { ProfitcenterService } from "./services/profitcenter.service";

import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profitcenter,
      UserPermissions,
      PermissionModule,
      Action,
    ]),
    UsersModule,
  ],

  controllers: [ProfitcenterController],

  providers: [
    ProfitcenterService,
    ResponseMapperService,
  ],

  exports: [ProfitcenterService],
})
export class ProfitcenterModule {}