import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Supplier } from "../../entities/Supplier";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";

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
  ],

  controllers: [SupplierController],

  providers: [
    SupplierService,
    ResponseMapperService,
  ],

  exports: [SupplierService],
})
export class SupplierModule {}