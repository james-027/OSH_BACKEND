import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { SystemsService } from "src/modules/systems/services/systems.service";
import { CreateSystemDto } from "src/modules/systems/dto/CreateSystemDto";
import { UpdateSystemDto } from "src/modules/systems/dto/UpdateSystemDto";

@Controller("systems")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemsController {
  constructor(private readonly systemsService: SystemsService) {}

  @Get()
  @RequirePermissions({ module: "SYSTEMS", action: "DATA ACCESS" })
  async findAll(@Request() req) {
    return this.systemsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "SYSTEMS", action: "DATA ACCESS" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.systemsService.findOne(id);
  }

  @Get(":id/nested")
  @RequirePermissions({ module: "SYSTEMS", action: "DATA ACCESS" })
  async nestedBySystem(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.systemsService.nestedBySystem(id);
  }

  @Post()
  @RequirePermissions({ module: "SYSTEMS", action: "ADD" })
  async create(@Body() createSystemDto: CreateSystemDto, @Request() req) {
    const userId = req.user.id;
    return this.systemsService.create(createSystemDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "SYSTEMS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSystemDto: UpdateSystemDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.systemsService.update(id, updateSystemDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "SYSTEMS", action: "DELETE" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.systemsService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "SYSTEMS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.systemsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "SYSTEMS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.systemsService.toggleStatus(id, userId);
  }
}
