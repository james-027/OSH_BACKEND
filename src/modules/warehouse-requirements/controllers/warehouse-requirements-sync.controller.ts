import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseRequirementsService } from "../services/warehouse-requirements.service";
import { CreateWarehouseRequirementDto } from "../dto/CreateWarehouseRequirementDto";
import { UpdateWarehouseRequirementDto } from "../dto/UpdateWarehouseRequirementDto";

@Controller("warehouse-requirements-sync")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseRequirementsSyncController {
  constructor(
    private readonly warehouseRequirementsService: WarehouseRequirementsService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAll(@Request() req) {
    return this.warehouseRequirementsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.warehouseRequirementsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async create(
    @Body() createWarehouseRequirementDto: CreateWarehouseRequirementDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.create(
      createWarehouseRequirementDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateWarehouseRequirementDto: UpdateWarehouseRequirementDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.update(
      id,
      updateWarehouseRequirementDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseRequirementsService.toggleStatus(id, userId);
  }

  @Post("sync")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async manualSync(@Request() req) {
    const year = Number(process.env.SYNC_YEAR) || new Date().getFullYear();
    return this.warehouseRequirementsService.syncWarehouseRequirements(year);
  }
}
