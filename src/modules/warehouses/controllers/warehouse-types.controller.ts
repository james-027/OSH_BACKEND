import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseTypesService } from "../services/warehouse-types.service";
import { CreateWarehouseTypeDto } from "../dto/CreateWarehouseTypeDto";
import { UpdateWarehouseTypeDto } from "../dto/UpdateWarehouseTypeDto";

@Controller("warehouse-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseTypesController {
  constructor(private readonly warehouseTypesService: WarehouseTypesService) {}

  @Get()
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "VIEW" })
  async findAll() {
    return this.warehouseTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "ADD" })
  async create(@Body() createDto: CreateWarehouseTypeDto, @Request() req) {
    const userId = req.user.id;
    return this.warehouseTypesService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseTypesService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseTypesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "WAREHOUSE_TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseTypesService.toggleStatus(id, userId);
  }
}
