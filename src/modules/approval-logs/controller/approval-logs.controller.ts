import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Body,
  Post,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";

import { PermissionsGuard } from "src/guards/permissions.guard";

import { RequirePermissions } from "src/decorators/permissions.decorator";

import { ApprovalLogsService } from "../services/approval-logs.service";
import { CreateApprovalStagesDto } from "../dto/CreateApprovalStagesDto";

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

  @Post("initialize")
  async initialize(@Body() dto: CreateApprovalStagesDto, @Request() req) {
    const userId = req.user.id;
    return this.approvalLogsService.initialize(dto, userId);
  }
}
