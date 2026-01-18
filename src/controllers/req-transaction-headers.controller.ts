import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Patch,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ReqTransactionHeadersService } from "../services/req-transaction-headers.service";
import { CreateReqTransactionHeaderDto } from "../dto/CreateReqTransactionHeaderDto";
import { UpdateReqTransactionHeaderDto } from "../dto/UpdateReqTransactionHeaderDto";
import { CreateReqTransactionWithDetailsDto } from "../dto/CreateReqTransactionWithDetailsDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { CreateWarehouseRequirementDueAndReqTransDto } from "src/dto/CreateWarehouseRequirementDueAndReqTransDto";

@Controller("req-transaction-headers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReqTransactionHeadersController {
  constructor(
    private readonly reqTransactionHeadersService: ReqTransactionHeadersService
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAll() {
    return await this.reqTransactionHeadersService.findAll();
  }

  @Get("group-by-trans-number")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findAllByTransNumber(
    @Request() req,
    @Query("transNumber") transNumber?: string
  ) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return await this.reqTransactionHeadersService.findAllByTransNumber(
      transNumber,
      userId,
      roleId
    );
  }

  @Get("find-by-trans-number")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOneByTransNumber(
    @Query("trans_number") transNumber: string,
    @Request() req
  ) {
    return await this.reqTransactionHeadersService.findOneByTransNumber(
      transNumber
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "VIEW" })
  async findOne(@Param("id") id: number) {
    return await this.reqTransactionHeadersService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async create(
    @Body() createDto: CreateReqTransactionHeaderDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "EDIT" })
  async update(
    @Param("id") id: number,
    @Body() updateDto: UpdateReqTransactionHeaderDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.update(
      id,
      updateDto,
      userId
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Patch(":trans_number/cancel-by-trans-number")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusCancelByTransNumber(
    @Param("trans_number") transNumber: string,
    @Body() body: { cancellation_reason: string },
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatusCancelByTransNumber(
      transNumber,
      userId,
      body.cancellation_reason
    );
  }

  @Post("batch-create")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "ADD" })
  async createWithDetails(
    @Body() createDto: CreateReqTransactionWithDetailsDto,
    @Request() req
  ) {
    const userId = req.user?.id || 1;
    const accessKeyId = req.user.current_access_key;
    return await this.reqTransactionHeadersService.createWithDetails(
      createDto,
      userId,
      accessKeyId
    );
  }

  /**
   * Deactivate warehouse requirement due
   * Cancel requirement transaction hdr and details
   * PATCH /req-transaction-headers/toggle-status-cancel
   */
  @Patch("toggle-status-cancel")
  @RequirePermissions({ module: "STORE REQUIREMENTS", action: "DEACTIVATE" })
  async toggleStatusCancel(
    @Body() updateDto: CreateWarehouseRequirementDueAndReqTransDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(
      updateDto.trans_header_id,
      userId,
      updateDto.status_id,
      updateDto.cancellation_reason
    );
  }
}
