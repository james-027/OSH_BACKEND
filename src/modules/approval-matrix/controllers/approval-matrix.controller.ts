import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

import { ApprovalMatrixService } from "../services/approval-matrix.service";
import { CreateApprovalMatrixDto } from "../dto/CreateApprovalMatrixDto";
import { UpdateApprovalMatrixDto } from "../dto/UpdateApprovalMatrixDto";

@Controller("approval-matrix")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalMatrixController {
  constructor(private readonly approvalMatrixService: ApprovalMatrixService) {}

  @Get()
  @RequirePermissions({
    module: "APPROVAL MATRIX",
    action: "VIEW",
  })
  async findAll() {
    return this.approvalMatrixService.findAll();
  }

  @Get("pagination")
  async Getbypagination(
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 5,
    @Query("search") search = "",
    @Query("statusid") statusId = "",
  ) {
    return this.approvalMatrixService.GetbysearchAndPages(
      Number(page),
      Number(pageSize),
      search,
      statusId,
    );
  }

  @Get(":id")
  @RequirePermissions({
    module: "APPROVAL MATRIX",
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.approvalMatrixService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: "APPROVAL MATRIX",
    action: "ADD",
  })
  async create(
    @Body() createApprovalMatrixDto: CreateApprovalMatrixDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;

    return this.approvalMatrixService.create(
      createApprovalMatrixDto,
      userId,
      accessKeyId,
    );
  }

  @Put(":id")
  @RequirePermissions({
    module: "APPROVAL MATRIX",
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateApprovalMatrixDto: UpdateApprovalMatrixDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;

    return this.approvalMatrixService.update(
      id,
      updateApprovalMatrixDto,
      userId,
      accessKeyId,
    );
  }

  @Delete(":id")
  @RequirePermissions({
    module: "APPROVAL MATRIX",
    action: "DELETE",
  })
  async delete(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;

    return this.approvalMatrixService.delete(id, userId);
  }
}
