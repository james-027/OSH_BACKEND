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
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { BrandGroupsService } from "../services/brand-groups.service";
import { CreateBrandGroupDto } from "../dto/CreateBrandGroupDto";
import { UpdateBrandGroupDto } from "../dto/UpdateBrandGroupDto";

@Controller("brand-groups")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BrandGroupsController {
  constructor(private readonly brandGroupsService: BrandGroupsService) {}

  @Get()
  @RequirePermissions({ module: "BRAND GROUPS", action: "VIEW" })
  async findAll() {
    return this.brandGroupsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "BRAND GROUPS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.brandGroupsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "BRAND GROUPS", action: "ADD" })
  async create(@Body() createDto: CreateBrandGroupDto, @Request() req) {
    const userId = req.user.id;
    return this.brandGroupsService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "BRAND GROUPS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateBrandGroupDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.brandGroupsService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "BRAND GROUPS", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.brandGroupsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "BRAND GROUPS", action: "EDIT" })
  async activateStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    // Force status to 1 (active)
    const group = await this.brandGroupsService.findOne(id);
    if (group.status_id === 1) return group;
    await this.brandGroupsService.toggleStatus(id, userId);
    return this.brandGroupsService.findOne(id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "BRAND GROUPS", action: "EDIT" })
  async deactivateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    // Force status to 2 (inactive)
    const group = await this.brandGroupsService.findOne(id);
    if (group.status_id === 2) return group;
    await this.brandGroupsService.toggleStatus(id, userId);
    return this.brandGroupsService.findOne(id);
  }
}
