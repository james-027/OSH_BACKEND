import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Supplier } from "../../entities/Supplier";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { SSEModule } from "../sse/sse.module"; //
import { SupplierController } from "./controllers/supplier.controller";
import { SupplierService } from "./services/supplier.service";

import { UsersModule } from "../users/users.module";

import { ResponseMapperService } from "../../services/response-mapper.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      UserPermissions,
      PermissionModule,
      Action,
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
export class SupplierModule { }