import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  BadRequestException,
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

  @Patch(":id/toggle-status-back-to-pending")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "REVERT",
  })
  async toggleStatusBackToPending(
    @Param("id", ParseIntPipe)
    id: number,

    @Body() body: any,

    @Request() req,
  ) {
    const userId =
      req.user.id;

    const status_id = 3;

    return this.approvalStagesListService.toggleStatus(
      id,

      userId,

      status_id,

      body?.approval_remarks,
    );
  }

  @Post("/change-bulk-status")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: [
      "POST",
      "APPROVE",
      "REJECT",
      "REVERT",
    ],
  })
  async toggleBulkStatus(
      @Body()
      body: {
        ids: number[];
        status_id: number;
        approval_remarks?: string;
      },

      @Request() req,
    ) {
      const userId =
        req.user.id;

      const {
        ids,
        status_id,
        approval_remarks,
      } = body;

      if (
        !Array.isArray(ids) ||
        typeof status_id !==
          "number"
      ) {
        throw new BadRequestException(
          "Invalid payload: ids and status_id are required.",
        );
      }

      return this.approvalStagesListService.toggleBulkStatus(
        ids,

        status_id,

        userId,

        approval_remarks,
      );
  }

  @Get("history/:id")
  @RequirePermissions({
    module: "DEBIT ADVICE APPROVAL",
    action: "VIEW",
  })
  async findOneHistory(
    @Param("id", ParseIntPipe)
    id: number,
  ) {
    return this.approvalStagesListService.findOneHistory(
      id,
    );
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
    const status_id = 15;

    return this.approvalStagesListService.toggleStatus(
      id,
      userId,
      status_id,
      body?.approval_remarks,
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