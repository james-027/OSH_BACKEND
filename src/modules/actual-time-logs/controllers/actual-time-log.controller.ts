import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { ActualTimeLogDetailService } from "src/modules/actual-time-logs/services/actual-time-log.service";

@Controller("actual-time-logs")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActualTimeLogsController {
  constructor(
    private readonly actualTimeLogsService: ActualTimeLogDetailService,
  ) {}

  @Get()
  @RequirePermissions({ module: "ACTUAL TIME LOGS", action: "VIEW" })
  async findAll(
    @Query("status_id") statusId?: string,
    @Request() req?: any,
  ) {
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    const accessKeyId = req?.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.actualTimeLogsService.findAll(
      parsedStatusId,
      accessKeyId,
      userId,
      roleId,
    );
  }

 
}
