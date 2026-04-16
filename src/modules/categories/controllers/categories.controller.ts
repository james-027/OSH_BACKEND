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
import { CategoriesService } from "src/modules/categories/services/categories.service";
import { CreateCategoryDto } from "src/modules/categories/dto/CreateCategoryDto";
import { UpdateCategoryDto } from "src/modules/categories/dto/UpdateCategoryDto";

@Controller("categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermissions({ module: "CATEGORIES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.categoriesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "CATEGORIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "CATEGORIES", action: "ADD" })
  async create(@Body() createCategoryDto: CreateCategoryDto, @Request() req) {
    const userId = req.user.id;
    return this.categoriesService.create(createCategoryDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "CATEGORIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoriesService.update(id, updateCategoryDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "CATEGORIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoriesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "CATEGORIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.categoriesService.toggleStatus(id, userId);
  }
}
