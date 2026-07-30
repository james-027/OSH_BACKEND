import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
  Patch,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

import { EmailNotificationMatrixService } from "../services/email-notification-matrix.service";
import { CreateEmailNotificationMatrixDto } from "../dto/CreateEmailNotificationMatrixDto";
import { UpdateEmailNotificationMatrixDto } from "../dto/UpdateEmailNotificationMatrixDto";

@Controller("email-notification-matrix")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailNotificationMatrixController {
  constructor(
    private readonly emailNotificationMatrixService: EmailNotificationMatrixService,
  ) {}

  @Get()
  @RequirePermissions({
    module: "EMAIL NOTIFICATION MATRIX",
    action: "DATA ACCESS",
  })
  async findAll() {
    return this.emailNotificationMatrixService.findAll();
  }

  @Get("pagination")
  async Getbypagination(
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 5,
    @Query("search") search = "",
    @Query("statusid") statusId = "",
  ) {
    return this.emailNotificationMatrixService.GetbysearchAndPages(
      Number(page),
      Number(pageSize),
      search,
      statusId,
    );
  }

  @Get(":id")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION MATRIX",
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.emailNotificationMatrixService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: "EMAIL NOTIFICATION MATRIX",
    action: "ADD",
  })
  async create(
    @Body() createEmailNotificationMatrixDto: CreateEmailNotificationMatrixDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;

    return this.emailNotificationMatrixService.create(
      createEmailNotificationMatrixDto,
      userId,
      accessKeyId,
    );
  }

  @Put(":id")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION MATRIX",
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateEmailNotificationMatrixDto: UpdateEmailNotificationMatrixDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;

    return this.emailNotificationMatrixService.update(
      id,
      updateEmailNotificationMatrixDto,
      userId,
      accessKeyId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: "EMAIL NOTIFICATION MATRIX",
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.emailNotificationMatrixService.toggleStatus(id, req.user.id);
  }

  @Patch(":id/toggle-status-deactivate")
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.emailNotificationMatrixService.toggleStatus(id, req.user.id);
  }
}
