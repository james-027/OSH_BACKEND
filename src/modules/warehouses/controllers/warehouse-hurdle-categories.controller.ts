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
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseHurdleCategoriesService } from "../services/warehouse-hurdle-categories.service";
import { CreateWarehouseHurdleCategoryDto } from "../dto/CreateWarehouseHurdleCategoryDto";
import { UpdateWarehouseHurdleCategoryDto } from "../dto/UpdateWarehouseHurdleCategoryDto";

@Controller("warehouse-hurdle-categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseHurdleCategoriesController {
  constructor(private readonly whcService: WarehouseHurdleCategoriesService) {}

  @Get()
  @RequirePermissions({ module: "WAREHOUSE_HURDLE_CATEGORIES", action: "VIEW" })
  async findAll() {
    return this.whcService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "WAREHOUSE_HURDLE_CATEGORIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.whcService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "WAREHOUSE_HURDLE_CATEGORIES", action: "ADD" })
  async create(
    @Body() createDto: CreateWarehouseHurdleCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.whcService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "WAREHOUSE_HURDLE_CATEGORIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseHurdleCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.whcService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({
    module: "WAREHOUSE_HURDLE_CATEGORIES",
    action: "CANCEL",
  })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.whcService.remove(id);
  }

  @Post(":id/toggle-status-activate")
  @RequirePermissions({
    module: "WAREHOUSE_HURDLE_CATEGORIES",
    action: "ACTIVATE",
  })
  async activate(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.whcService.toggleStatus(id, true, userId);
  }

  @Post(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "WAREHOUSE_HURDLE_CATEGORIES",
    action: "DEACTIVATE",
  })
  async deactivate(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.whcService.toggleStatus(id, false, userId);
  }
}
