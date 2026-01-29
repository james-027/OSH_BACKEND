import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiController } from "../../controllers/api.controller";
import { ApiService } from "../../services/api.service";
import { ApiKeyGuard } from "../../guards/api-key.guard";
import { ApiKey } from "../../entities/ApiKey";
import { ApiAuthAccess } from "../../entities/ApiAuthAccess";
import { ApiLogs } from "../../entities/ApiLogs";
import { WarehouseHurdle } from "../../entities/WarehouseHurdle";
import { WarehouseHurdleCategory } from "../../entities/WarehouseHurdleCategory";
import { LocationHurdle } from "../../entities/LocationHurdle";
import { LocationHurdleCategory } from "../../entities/LocationHurdleCategory";

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
    ]),
  ],
  controllers: [ApiController],
  providers: [ApiService, ApiKeyGuard],
  exports: [ApiService, ApiKeyGuard],
})
export class ApiModule {}
