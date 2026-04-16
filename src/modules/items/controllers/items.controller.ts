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
import { ItemsService } from "../services/items.service";
import { CreateItemDto } from "../dto/CreateItemDto";
import { UpdateItemDto } from "../dto/UpdateItemDto";

@Controller("items")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @RequirePermissions({ module: "ITEMS", action: "VIEW" })
  async findAll() {
    return this.itemsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "ITEMS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.itemsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "ITEMS", action: "ADD" })
  async create(@Body() createDto: CreateItemDto, @Request() req) {
    const userId = req.user.id;
    return this.itemsService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "ITEMS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateItemDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemsService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "ITEMS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.itemsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "ITEMS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "ITEMS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.itemsService.toggleStatus(id, userId);
  }
}
