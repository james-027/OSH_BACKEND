import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { RolesService } from "../services/roles.service";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { CreateRoleDto } from "../dto/CreateRoleDto";
import { UpdateRoleDto } from "../dto/UpdateRoleDto";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { PermissionsGuard } from "src/guards/permissions.guard";

@Controller("roles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions({ module: "ROLES", action: "DATA ACCESS" })
  async findAll(@Request() req) {
    return this.rolesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "ROLES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "ROLES", action: "ADD" })
  async create(@Body() createRoleDto: CreateRoleDto, @Request() req) {
    const userId = req.user.id;
    return this.rolesService.create(createRoleDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "ROLES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.rolesService.update(id, updateRoleDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "ROLES", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.rolesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "ROLES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.rolesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "ROLES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.rolesService.toggleStatus(id, userId);
  }
}
