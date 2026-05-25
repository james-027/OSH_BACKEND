import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";

import { ApprovalStagesListService } from "../services/debit-advice-approval.service";
import { UpdateApprovalStagesListDto } from "../dto/UpdateDebitAdviceApprovalDto";

@Controller("debit-advice-approval")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebitAdviceApprovalController {
  constructor(
    private readonly approvalStagesListService: ApprovalStagesListService,
  ) {}


    @Get()
    @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "VIEW",
    })
    async findAll() {
    return this.approvalStagesListService.findAll();
    }

  @Get(":id")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "VIEW",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.approvalStagesListService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "ADD",
  })



  @Put(":id")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body()
    updateDto: UpdateApprovalStagesListDto,
    @Request() req,
  ) {
    const userId = req.user.id;

    return this.approvalStagesListService.update(
      id,
      updateDto,
      userId,
    );
  }

  @Delete(":id")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "CANCEL",
  })
  async remove(
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.approvalStagesListService.remove(id);
  }

  @Patch(":id/toggle-status-approved")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "APPROVE",
  })
  async toggleStatusApproved(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 7;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
    );
  }

  @Patch(":id/toggle-status-rejected")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "REJECT",
  })
  async toggleStatusRejected(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 8;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
      body?.approval_remarks,
    );
  }

  @Patch(":id/toggle-status-for-approval")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "EDIT",
  })
  async toggleStatusForApproval(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 6;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 2;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
    );
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 1;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
    );
  }
}