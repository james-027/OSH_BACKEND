import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

import { EmailQueueService } from "../services/email-queue.service";

@Controller("email-queue")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailQueueController {
  constructor(private readonly emailQueueService: EmailQueueService) {}

  @Get()
  @RequirePermissions({
    module: "EMAIL NOTIFICATION QUEING",
    action: "DATA ACCESS",
  })
  async findAll(@Query("statusid") statusId?: number) {
    return this.emailQueueService.findAll(
      statusId ? Number(statusId) : undefined,
    );
  }

  @Patch(":id/manual-execute")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION QUEING",
    action: "EDIT",
  })
  async manualExecute(@Param("id", ParseIntPipe) id: number) {
    await this.emailQueueService.triggerManualExecute(id);

    return {
      success: true,
      message: "Email queued for manual execution.",
    };
  }
}
