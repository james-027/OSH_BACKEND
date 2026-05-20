import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Supplier } from "../../entities/Supplier";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Status } from "../../entities/Status";
import { User } from "../../entities/User";

import { SupplierController } from "./controllers/supplier.controller";
import { SupplierService } from "./services/supplier.service";

import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      UserPermissions,
      PermissionModule,
      Action,
      Status,
      User,
    ]),
    UsersModule,
    SSEModule,
  ],

  controllers: [SupplierController],

  providers: [
    SupplierService,
    ResponseMapperService,
  ],

  exports: [SupplierService],
})
export class SupplierModule {}