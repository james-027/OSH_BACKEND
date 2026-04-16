import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  Patch,
} from "@nestjs/common";
import { ModulesService } from "../services/modules.service";
import { CreateModuleDto } from "../dto/CreateModuleDto";
import { UpdateModuleDto } from "../dto/UpdateModuleDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("modules")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @RequirePermissions({ module: "MODULES", action: "DATA ACCESS" })
  async findAll() {
    return this.modulesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "MODULES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "MODULES", action: "ADD" })
  async create(@Body() createModuleDto: CreateModuleDto, @Request() req) {
    return this.modulesService.create(createModuleDto, req.user.id);
  }

  @Put(":id")
  @RequirePermissions({ module: "MODULES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateModuleDto: UpdateModuleDto,
    @Request() req,
  ) {
    return this.modulesService.update(id, updateModuleDto, req.user.id);
  }

  @Delete(":id")
  @RequirePermissions({ module: "MODULES", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.modulesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "MODULES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.modulesService.toggleStatus(id, req.user.id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "MODULES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.modulesService.toggleStatus(id, req.user.id);
  }
}
