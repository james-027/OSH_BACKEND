import {
  Controller,
  Get,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseMasterDataService } from "../services/warehouse-masterdata.service";

@Controller("warehousesmasterdata")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesmasterdataController {
  constructor(private readonly warehouseMasterDataService: WarehouseMasterDataService) {}

  @Get()
  async findAll(@Request() req) {
    return this.warehouseMasterDataService.findAll();
  }


}
