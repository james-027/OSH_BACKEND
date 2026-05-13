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
import { AuditFormDetailsService } from "src/modules/audit-form-details/services/audit-form-details.service";
import { CreateAuditFormDetailsDto } from "src/modules/audit-form-details/dto/CreateAuditFormDetailsDto";
import { UpdateAuditFormDetailsDto } from "src/modules/audit-form-details/dto/UpdateAuditFormDetailsDto";

@Controller("audit-form-details")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditFormDetailsController {
  constructor(private readonly auditFormDetailsService: AuditFormDetailsService) {}

  @Get()
  @RequirePermissions({ module: "STORE AUDIT", action: "VIEW" })
  async findAll(@Request() req) {
    return this.auditFormDetailsService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE AUDIT", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    return this.auditFormDetailsService.findOne(id);
  }

  @Post()
  // @RequirePermissions({ module: "STORE AUDIT", action: "ADD" })
  async create(
    @Body() createAuditFormDetailDto: CreateAuditFormDetailsDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditFormDetailsService.create(createAuditFormDetailDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE AUDIT", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateAuditFormDetailDto: UpdateAuditFormDetailsDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditFormDetailsService.update(id, updateAuditFormDetailDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE AUDIT", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditFormDetailsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE AUDIT", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.auditFormDetailsService.toggleStatus(id, userId);
  }
}
