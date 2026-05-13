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
import { RoleActionPresetsService } from "../services/role-action-presets.service";
import { CreateRolePresetDto } from "../dto/CreateRolePresetDto";
import { UpdateRolePresetDto } from "../dto/UpdateRolePresetDto";
import { CreateRoleActionPresetDto } from "src/modules/roles/dto/CreateRoleActionPresetDto";
import { UpdateRoleActionPresetDto } from "src/modules/roles/dto/UpdateRoleActionPresetDto";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { Throttle } from "@nestjs/throttler";

@Controller("role-action-presets")
@UseGuards(JwtAuthGuard)
export class RoleActionPresetsController {
  constructor(
    private readonly roleActionPresetsService: RoleActionPresetsService,
  ) {}

  @Get()
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async findAll() {
    return this.roleActionPresetsService.findAll();
  }

  @Get("roles-not-in-presets")
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async findRolesNotInPresets(@Request() req) {
    // const userId = req.user.id;
    return this.roleActionPresetsService.findRolesNotInPresets();
  }

  @Get(":id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.roleActionPresetsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "ROLE PRESETS", action: "ADD" })
  async create(
    @Body() createRoleActionPresetDto: CreateRoleActionPresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.create(
      createRoleActionPresetDto,
      userId,
    );
  }

  @Patch(":id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRoleActionPresetDto: UpdateRoleActionPresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.update(
      id,
      updateRoleActionPresetDto,
      userId,
    );
  }

  @Delete(":id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.roleActionPresetsService.remove(id);
  }

  @Patch(":id/toggle-status")
  @RequirePermissions({ module: "ROLE PRESETS", action: "EDIT" })
  async toggleStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.roleActionPresetsService.toggleStatus(id, userId);
  }
}

@Controller("role-presets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolePresetsController {
  constructor(
    private readonly roleActionPresetsService: RoleActionPresetsService,
  ) {}

  @Get("nested")
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async nested(@Request() req) {
    return this.roleActionPresetsService.nested();
  }

  @Throttle({ default: { limit: 2000, ttl: 60000 } })
  @Get("nested/:id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async nestedByRole(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.roleActionPresetsService.nestedByRole(id);
  }

  @Get(":role_id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "VIEW" })
  async getRolePresets(
    @Param("role_id", ParseIntPipe) roleId: number,
    @Request() req,
  ) {
    // This should return role presets for a specific role ID
    return this.roleActionPresetsService.nestedByRole(roleId);
  }
  @Post()
  @RequirePermissions({ module: "ROLE PRESETS", action: "ADD" })
  async create(
    @Body() createRolePresetDto: CreateRolePresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.createRolePreset(
      createRolePresetDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "ROLE PRESETS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRolePresetDto: UpdateRolePresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.updateRolePreset(
      id,
      updateRolePresetDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "ROLE PRESETS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "ROLE PRESETS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleActionPresetsService.toggleStatus(id, userId);
  }
}
