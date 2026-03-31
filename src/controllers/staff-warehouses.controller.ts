import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { StaffWarehousesService } from "src/services/staff-warehouses.service";
import { CreateStaffWarehouseDto } from "src/dto/CreateStaffWarehouseDto";
import { UpdateStaffWarehouseDto } from "src/dto/UpdateStaffWarehouseDto";

@Controller("staff-warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StaffWarehousesController {
  constructor(
    private readonly staffWarehousesService: StaffWarehousesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.staffWarehousesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.staffWarehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "ADD" })
  async create(
    @Body() createStaffWarehouseDto: CreateStaffWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.create(createStaffWarehouseDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateStaffWarehouseDto: UpdateStaffWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.update(
      id,
      updateStaffWarehouseDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STAFF WAREHOUSES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.staffWarehousesService.toggleStatus(id, userId);
  }
}
