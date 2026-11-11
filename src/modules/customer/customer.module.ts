import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Customer } from "../../entities/Customer";
import { UserPermissions } from "../../entities/UserPermissions";
import { Module as PermissionModule } from "../../entities/Module";
import { Action } from "../../entities/Action";
import { Status } from "../../entities/Status";
import { User } from "../../entities/User";

import { CustomerController } from "./controllers/customer.controller";
import { CustomerService } from "./services/customer.service";



import { UsersModule } from "../users/users.module";
import { SSEModule } from "../sse/sse.module";

import { ResponseMapperService } from "../../services/response-mapper.service";
import { CustomerSyncService } from "./services/customer-sync";
import { CustomerMasterDataScheduler } from "src/schedulers/customer-sync.scheduler";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      UserPermissions,
      PermissionModule,
      Action,
      Status,
      User,
    ]),
    UsersModule,
    SSEModule,
  ],

  controllers: [CustomerController],

  providers: [
    CustomerService,
    CustomerSyncService,
    CustomerMasterDataScheduler,
    ResponseMapperService,
  ],

  exports: [CustomerService, CustomerSyncService],
})
export class CustomerModule {}