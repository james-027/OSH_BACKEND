import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { ItemCategoriesService } from "../services/item-categories.service";
import { CreateItemCategoryDto } from "../dto/CreateItemCategoryDto";
import { UpdateItemCategoryDto } from "../dto/UpdateItemCategoryDto";

@Controller("item-categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemCategoriesController {
  constructor(private readonly itemCategoriesService: ItemCategoriesService) {}

  @Get()
  // @RequirePermissions({ module: "ITEM_CATEGORIES", action: "VIEW" })
  async findAll() {
    return this.itemCategoriesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.itemCategoriesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "ADD" })
  async create(@Body() createDto: CreateItemCategoryDto, @Request() req) {
    const userId = req.user.id;
    return this.itemCategoriesService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateItemCategoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemCategoriesService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.itemCategoriesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemCategoriesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "ITEM_CATEGORIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemCategoriesService.toggleStatus(id, userId);
  }
}
