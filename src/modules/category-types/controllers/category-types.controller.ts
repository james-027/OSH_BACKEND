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
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { CategoryTypesService } from "src/modules/category-types/services/category-types.service";
import { CreateCategoryTypeDto } from "src/modules/category-types/dto/CreateCategoryTypeDto";
import { UpdateCategoryTypeDto } from "src/modules/category-types/dto/UpdateCategoryTypeDto";

@Controller("category-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoryTypesController {
  constructor(private readonly categoryTypesService: CategoryTypesService) {}

  @Get()
  @RequirePermissions({ module: "CATEGORY TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.categoryTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "CATEGORY TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.categoryTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "CATEGORY TYPES", action: "ADD" })
  async create(
    @Body() createCategoryTypeDto: CreateCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoryTypesService.create(createCategoryTypeDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "CATEGORY TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCategoryTypeDto: UpdateCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoryTypesService.update(id, updateCategoryTypeDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "CATEGORY TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoryTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "CATEGORY TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoryTypesService.toggleStatus(id, userId);
  }
}
