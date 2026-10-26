import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Patch,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehousesService } from "../services/warehouses.service";
import { CreateWarehouseDto } from "../dto/CreateWarehouseDto";
import { UpdateWarehouseDto } from "../dto/UpdateWarehouseDto";
import { BulkChangeWarehouseStatusDto } from "../dto/BulkChangeWarehouseStatusDto";
import { CacheCustom } from "src/decorators/cache.decorator";
import { buildWarehouseKey, CACHE_TTL } from "src/config/cache.config";

@Controller("warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get("/stores")
  @CacheCustom(buildWarehouseKey, CACHE_TTL.COUNTS)
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.warehousesService.findAll(
      undefined,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Get("/stores/:warehouse_type_id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findAllByType(
    @Param("warehouse_type_id", ParseIntPipe) warehouseTypeId: number,
    @Request() req,
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.warehousesService.findAll(
      warehouseTypeId,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Post("/change-bulk-status")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "POST" })
  async toggleBulkStatus(
    @Body() bulkStatusDto: BulkChangeWarehouseStatusDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleBulkStatus(
      bulkStatusDto.ids,
      bulkStatusDto.status_id,
      userId,
      bulkStatusDto.undo_reason,
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "ADD" })
  async create(@Body() createDto: CreateWarehouseDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehousesService.create(
      { ...createDto, access_key_id: accessKeyId },
      userId,
    );
  }

  @Patch(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.update(id, updateDto, userId);
  }

  @Patch(":id/change-status")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "POST" })
  async changeStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status_id: number; undo_reason?: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.changeRemStatus(
      id,
      body.status_id,
      userId,
      body.undo_reason,
    );
  }

  @Delete(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user?.id;
    return this.warehousesService.remove(id, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }
}
