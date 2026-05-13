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
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { AuditCategoryTypesService } from "src/modules/audit-category-types/services/audit-category-types.service";
import { CreateAuditCategoryTypeDto } from "src/modules/audit-category-types/dto/CreateAuditCategoryTypeDto";
import { UpdateAuditCategoryTypeDto } from "src/modules/audit-category-types/dto/UpdateAuditCategoryTypeDto";

@Controller("audit-category-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditCategoryTypesController {
  constructor(private readonly auditCategoryTypesService: AuditCategoryTypesService) {}

  @Get()
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "VIEW" })
  async findAll(@Request() req) {
    return this.auditCategoryTypesService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.auditCategoryTypesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "ADD" })
  async create(
    @Body() createAuditCategoryTypeDto: CreateAuditCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditCategoryTypesService.create(createAuditCategoryTypeDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateAuditCategoryTypeDto: UpdateAuditCategoryTypeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditCategoryTypesService.update(id, updateAuditCategoryTypeDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditCategoryTypesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "AUDIT CATEGORY TYPES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditCategoryTypesService.toggleStatus(id, userId);
  }
}
