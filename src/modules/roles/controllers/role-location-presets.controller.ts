import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { RoleLocationPresetsService } from "../services/role-location-presets.service";
import { CreateRoleLocationPresetDto } from "src/modules/roles/dto/CreateRoleLocationPresetDto";
import { UpdateRoleLocationPresetDto } from "src/modules/roles/dto/UpdateRoleLocationPresetDto";

@Controller("role-location-presets")
@UseGuards(JwtAuthGuard)
export class RoleLocationPresetsController {
  constructor(
    private readonly roleLocationPresetsService: RoleLocationPresetsService,
  ) {}

  @Get()
  async findAll() {
    return this.roleLocationPresetsService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.roleLocationPresetsService.findOne(id);
  }

  @Post()
  async create(
    @Body() createRoleLocationPresetDto: CreateRoleLocationPresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleLocationPresetsService.create(
      createRoleLocationPresetDto,
      userId,
    );
  }

  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRoleLocationPresetDto: UpdateRoleLocationPresetDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.roleLocationPresetsService.update(
      id,
      updateRoleLocationPresetDto,
      userId,
    );
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.roleLocationPresetsService.remove(id);
  }

  @Patch(":id/toggle-status")
  async toggleStatus(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    return this.roleLocationPresetsService.toggleStatus(id, userId);
  }
}
