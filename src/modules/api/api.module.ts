import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiController } from "./controllers/api.controller";
import { ApiService } from "./services/api.service";
import { ApiKeyGuard } from "../../guards/api-key.guard";
import { ApiKey } from "../../entities/ApiKey";
import { ApiAuthAccess } from "../../entities/ApiAuthAccess";
import { ApiLogs } from "../../entities/ApiLogs";
import { WarehouseHurdle } from "../../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../../entities/WarehouseHurdleCategory";
import { LocationHurdle } from "../../entities/LocationHurdle";
import { LocationHurdleCategory } from "../../entities/LocationHurdleCategory";
import { Warehouse } from "src/entities/Warehouse";
import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "src/entities/WarehouseRequirementDue";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { ReqTransactionDue } from "src/entities/ReqTransactionDue";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { TransactionSequence } from "src/entities/TransactionSequence";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      ApiAuthAccess,
      ApiLogs,
      WarehouseHurdle,
      WarehouseHurdleCategory,
      LocationHurdle,
      LocationHurdleCategory,
      Warehouse,
      WarehouseRequirement,
      WarehouseRequirementDue,
      ReqTransactionHeader,
      ReqTransactionDue,
      ReqTransactionDetail,
      TransactionSequence,
    ]),
    UsersModule,
  ],
  controllers: [ApiController],
  providers: [ApiService, ApiKeyGuard, CommonUtilitiesService],
  exports: [ApiService, ApiKeyGuard],
})
export class ApiModule {}
