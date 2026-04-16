import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReqTransactionDetail } from "../../entities/ReqTransactionDetail";
import { ReqTransactionHeader } from "../../entities/ReqTransactionHeader";
import { SyncLog } from "../../entities/syncLog";
import { ReqTransactionDetailsService } from "./services/req-transaction-details.service";
import { ReqTransactionDetailsController } from "./controllers/req-transaction-details.controller";
import { UsersModule } from "../users/users.module";
import { UserAuditTrailModule } from "../users/user-audit-trail.module";
import { ResponseMapperService } from "../../services/response-mapper.service";
import { Module as AppModule } from "src/entities/Module";
import { Action } from "src/entities/Action";
import { UserPermissions } from "src/entities/UserPermissions";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReqTransactionDetail,
      ReqTransactionHeader,
      SyncLog,
      AppModule,
      Action,
      UserPermissions,
    ]),
    UsersModule,
    UserAuditTrailModule,
  ],
  controllers: [ReqTransactionDetailsController],
  providers: [ReqTransactionDetailsService, ResponseMapperService],
  exports: [ReqTransactionDetailsService],
})
export class ReqTransactionDetailsModule {}
