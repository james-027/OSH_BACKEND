import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  ParseIntPipe,
} from "@nestjs/common";
import { AuditFormService } from "../services/audit-forms.service";
import { CreateAuditFormDto } from "../dto/CreateAuditFormDto";
import { UpdateAuditFormDto } from "../dto/UpdateAuditFormDto";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { DynamicPermissionsGuard } from "../../../guards/dynamic-permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";


@Controller("audit-forms")
@UseGuards(JwtAuthGuard)
export class AuditFormsController {
  constructor(private readonly auditFormsService: AuditFormService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "AUDIT FORMS", action: "ADD" })
  async create(@Body() createAuditFormDto: CreateAuditFormDto, @Req() req: any) {
    const userId = req.user.id;
    return await this.auditFormsService.create(createAuditFormDto, userId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "AUDIT FORMS", action: "VIEW" })
  async findAll() {
    return await this.auditFormsService.findAll();
  }

  @Get(":id")
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "AUDIT FORMS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return await this.auditFormsService.findOne(id);
  }

  @Put(":id")
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "AUDIT FORMS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateAuditFormDto: UpdateAuditFormDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.auditFormsService.update(id, updateAuditFormDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "AUDIT FORMS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.auditFormsService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @UseGuards(DynamicPermissionsGuard)
  @RequirePermissions({ module: "AUDIT FORMS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return await this.auditFormsService.toggleStatus(id, userId);
  }


}
