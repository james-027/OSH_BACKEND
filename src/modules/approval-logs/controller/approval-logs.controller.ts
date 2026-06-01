import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";

import { PermissionsGuard } from "src/guards/permissions.guard";

import { RequirePermissions } from "src/decorators/permissions.decorator";

import { ApprovalLogsService } from "../services/approval-logs.service";

@Controller("approval-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalLogsController {
  constructor(private readonly approvalLogsService: ApprovalLogsService) {}

  @Get(":id")
  @RequirePermissions({
    module: ["DEBIT ADVICE", "FINANCE CONFIRMATION"],
    action: "VIEW",
  })
  async findOne(
    @Param("id", ParseIntPipe)
    id: number,

    @Request() req,
  ) {
    return this.approvalLogsService.findByHeaderId(id);
  }
}
