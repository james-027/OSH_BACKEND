import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Patch,
} from "@nestjs/common";
import { TransactionsService } from "../services/transactions.service";
import { CreateTransactionHeaderDto } from "../dto/CreateTransactionHeaderDto";
import { UpdateTransactionHeaderDto } from "../dto/UpdateTransactionHeaderDto";
import { CreateTransactionDetailDto } from "../dto/CreateTransactionDetailDto";
import { UpdateTransactionDetailDto } from "../dto/UpdateTransactionDetailDto";
import { Request } from "express";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";

@Controller("transactions")
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  // HEADER ENDPOINTS
  @Post("trans-headers")
  createHeader(@Body() dto: CreateTransactionHeaderDto) {
    return this.service.createHeader(dto);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "VIEW" })
  @Get("headers")
  findAllHeaders(@Req() req: any) {
    const user = req.user || {};
    return this.service.findAllHeaders(
      user.id,
      user.role_id,
      user.current_access_key,
    );
  }

  @Get("headers/:id")
  findHeaderById(@Param("id") id: number) {
    return this.service.findHeaderById(id);
  }

  @Put("headers/:id")
  updateHeader(
    @Param("id") id: number,
    @Body() dto: UpdateTransactionHeaderDto,
  ) {
    return this.service.updateHeader(id, dto);
  }

  @Delete("headers/:id")
  removeHeader(@Param("id") id: number) {
    return this.service.removeHeader(id);
  }

  // Toggle status of a transaction header
  @Put("headers/:id/toggle-status")
  toggleStatus(
    @Param("id") id: number,
    @Body("status_id") status_id: number,
    @Req() req: any,
  ) {
    const user = req.user || {};
    return this.service.toggleStatus(id, status_id, user.id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "POST" })
  // Post transaction (set status_id to 4)
  @Patch("headers/:id/post")
  postTransaction(@Param("id") id: number, @Req() req: any) {
    const user = req.user || {};
    return this.service.postTransaction(id, user.id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "CANCEL" })
  // Cancel transaction (set status_id to 5)
  @Patch("headers/:id/cancel")
  cancelTransaction(
    @Param("id") id: number,
    @Req() req: any,
    @Body("cancel_reason") cancel_reason: string,
  ) {
    const user = req.user || {};
    return this.service.cancelTransaction(id, user.id, cancel_reason);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "REVERT" })
  @Patch("headers/:id/revert")
  revertTransaction(
    @Param("id") id: number,
    @Req() req: any,
    @Body("undo_reason") undo_reason: string,
  ) {
    const user = req.user || {};
    return this.service.revertTransaction(id, user.id, undo_reason);
  }

  // DETAIL ENDPOINTS
  @Post("details")
  createDetail(@Body() dto: CreateTransactionDetailDto) {
    return this.service.createDetail(dto);
  }

  @Get("details")
  findAllDetails(@Query("headerId") headerId?: number) {
    return this.service.findAllDetails(headerId);
  }

  @Get("details/:id")
  findDetailById(@Param("id") id: number) {
    return this.service.findDetailById(id);
  }

  @Put("details/:id")
  updateDetail(
    @Param("id") id: number,
    @Body() dto: UpdateTransactionDetailDto,
  ) {
    return this.service.updateDetail(id, dto);
  }

  @Delete("details/:id")
  removeDetail(@Param("id") id: number) {
    return this.service.removeDetail(id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "ADD" })
  // CREATE TRANSACTION (merge logic)
  @Post("create-merged-transaction")
  createMergedTransaction(
    @Body() dto: { location_ids: number[]; trans_date: string },
    @Req() req: any,
  ) {
    // JWT payload user info
    const user = req.user || {};
    const created_by = user.id;
    const access_key_id = user.current_access_key;
    const role_id = user.role_id;
    return this.service.createTransaction({
      location_ids: dto.location_ids,
      trans_date: dto.trans_date,
      created_by,
      access_key_id,
      user_id: created_by,
      role_id,
    });
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE TRANSACTIONS", action: "EDIT" })
  @Post("batch-update")
  batchUpdateTransactions(
    @Body()
    payload: {
      header_updates?: Array<{
        transaction_header_id: number;
        trans_date?: string;
      }>;
      detail_updates?: Array<{
        transaction_header_id: number;
        rate?: number;
        ss_hurdle_qty?: number;
        budget_volume?: number;
      }>;
    },
  ) {
    return this.service.batchUpdateTransactions(payload);
  }

  /**
   * GET /transactions/report
   * Query params: location_ids (comma-separated), trans_date (YYYY-MM-DD), warehouse_id, status_id
   * Example: /transactions/report?location_ids=1,2&trans_date=2025-05-01&warehouse_id=5&status_id=4
   *
   * Now requires JWT user (for allowed locations and access_key filtering)
   */
  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "INCENTIVE REPORTS", action: "VIEW" })
  @Get("report")
  async getTransactionReport(
    @Query("location_ids") location_ids?: string,
    @Query("trans_date") trans_date?: string,
    @Query("warehouse_id") warehouse_id?: number,
    @Query("status_id") status_id?: number,
    @Req() req?: any,
  ) {
    // Parse location_ids as array of numbers if provided
    let locationIdsArr: number[] | undefined = undefined;
    if (location_ids) {
      locationIdsArr = location_ids
        .split(",")
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));
    }
    const user = req?.user || {};
    return this.service.generateTransactionReport({
      location_ids: locationIdsArr,
      trans_date,
      warehouse_id: warehouse_id ? Number(warehouse_id) : undefined,
      status_id: status_id ? Number(status_id) : undefined,
      user_id: user.id,
      role_id: user.role_id,
      current_access_key: user.current_access_key,
    });
  }
}
