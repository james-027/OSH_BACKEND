import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";

import { MasterDataSyncService } from "../services/master-data-sync.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { MasterDataSyncType } from "src/entities/MasterDataSyncLog";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("master-data-sync")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MasterDataSyncController {
  constructor(private readonly masterDataSyncService: MasterDataSyncService) {}
  @Get("logs")
  async getLogs(
    @Query("page") page = "0",
    @Query("pageSize") pageSize = "10",
    @Query("date_from") dateFrom?: string,
    @Query("date_to") dateTo?: string,
  ) {
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);

    if (!Number.isInteger(parsedPage) || parsedPage < 0) {
      throw new BadRequestException("Page must be a non-negative integer.");
    }

    if (
      !Number.isInteger(parsedPageSize) ||
      parsedPageSize < 1 ||
      parsedPageSize > 100
    ) {
      throw new BadRequestException("Page size must be between 1 and 100.");
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException("Date from cannot be later than date to.");
    }

    return this.masterDataSyncService.getLogs(
      parsedPage,
      parsedPageSize,
      dateFrom,
      dateTo,
    );
  }

  @Post(":type")
  @RequirePermissions({
    module: "MASTER DATA SYNC",
    action: "EDIT",
  })
  async sync(@Param("type") type: string, @Request() req) {
    const validTypes = Object.values(MasterDataSyncType);

    if (!validTypes.includes(type as MasterDataSyncType)) {
      throw new BadRequestException(
        `Unsupported master data sync type: ${type}`,
      );
    }

    const userId = req.user.id;

    return this.masterDataSyncService.sync(type as MasterDataSyncType, userId);
  }
}
