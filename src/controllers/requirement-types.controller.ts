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
import { RequirementTypesService } from "src/services/requirement-types.service";
import { CreateRequirementTypeDto } from "src/dto/CreateRequirementTypeDto";
import { UpdateRequirementTypeDto } from "src/dto/UpdateRequirementTypeDto";

@Controller("requirement-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RequirementTypesController {
  constructor(
    private readonly requirementTypesService: RequirementTypesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.requirementTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.requirementTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "ADD" })
  async create(
    @Body() createRequirementTypeDto: CreateRequirementTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.requirementTypesService.create(
      createRequirementTypeDto,
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateRequirementTypeDto: UpdateRequirementTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.requirementTypesService.update(
      id,
      updateRequirementTypeDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.requirementTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "REQUIREMENT TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.requirementTypesService.toggleStatus(id, userId);
  }
}
