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
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { RequirementsService } from "src/services/requirements.service";
import { CreateRequirementDto } from "src/dto/CreateRequirementDto";
import { UpdateRequirementDto } from "src/dto/UpdateRequirementDto";

@Controller("requirements")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get()
  @RequirePermissions({ module: "REQUIREMENTS", action: "VIEW" })
  async findAll(@Request() req) {
    return this.requirementsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "REQUIREMENTS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.requirementsService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "REQUIREMENTS", action: "ADD" })
  async create(
    @Body() createRequirementDto: CreateRequirementDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.requirementsService.create(createRequirementDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "REQUIREMENTS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRequirementDto: UpdateRequirementDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.requirementsService.update(id, updateRequirementDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "REQUIREMENTS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.requirementsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.requirementsService.toggleStatus(id, userId);
  }
}
