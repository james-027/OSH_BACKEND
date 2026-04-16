import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { UserAuditTrailService } from "../services/user-audit-trail.service";

@Controller("user-audit-trail")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserAuditTrailController {
  constructor(private readonly userAuditTrailService: UserAuditTrailService) {}

  @Get()
  @RequirePermissions({ module: "AUDIT TRAIL", action: "VIEW" })
  async findAll() {
    return this.userAuditTrailService.findAll();
  }

  @Get(":id")
  @RequirePermissions({ module: "AUDIT TRAIL", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.userAuditTrailService.findOne(id);
  }
}
