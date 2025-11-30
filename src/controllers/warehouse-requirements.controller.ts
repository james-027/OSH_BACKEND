import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Patch,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { WarehousesService } from "../services/warehouses.service";

@Controller("warehouse-requirements")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesRequirementsController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get("/stores/:warehouse_type_id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findAll(
    @Param("warehouse_type_id", ParseIntPipe) warehouseTypeId: number,
    @Request() req
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    return this.warehousesService.findAll(
      warehouseTypeId,
      accessKeyId,
      userId,
      roleId
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }
}
