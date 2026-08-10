import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
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

  @Post("process-pending")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION QUEING",
    action: "EDIT",
  })
  async processPending(@Body() body: { retryFailed?: boolean }) {
    // We don't await this so it runs in the background and doesn't block the HTTP request
    this.emailQueueService.processPendingQueue(body?.retryFailed === true);

    return {
      success: true,
      message:
        body?.retryFailed === true
          ? "Pending and failed queues are now processing in the background."
          : "Pending queues are now processing in the background.",
    };
  }
  @Post(":id/retry")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION QUEING",
    action: "EDIT",
  })
  async retryFailedEmail(@Param("id", ParseIntPipe) id: number) {
    await this.emailQueueService.triggerManualExecute(id);

    return {
      success: true,
      message: `Manual retry triggered for queue item #${id}`,
    };
  }
}
