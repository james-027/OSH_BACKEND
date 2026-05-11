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
import { Throttle } from "@nestjs/throttler";
import { CacheTransactions } from "src/decorators/cache.decorator";
import {
  CACHE_KEYS,
  buildReqTransHeaderGroupKey,
  buildReqTransHeaderFindByTransKey,
} from "src/config/cache.config";
import { ReqTransactionHeadersService } from "../services/req-transaction-headers.service";
import { CreateReqTransactionHeaderDto } from "../dto/CreateReqTransactionHeaderDto";
import { UpdateReqTransactionHeaderDto } from "../dto/UpdateReqTransactionHeaderDto";
import { CreateReqTransactionWithDetailsDto } from "../../../dto/CreateReqTransactionWithDetailsDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { CreateWarehouseRequirementDueAndReqTransDto } from "src/modules/req-transaction-headers/dto/CreateWarehouseRequirementDueAndReqTransDto";
import { WhReqListingDto } from "src/dto/query-params/CommonQueryDtos";
import { validateDateParam } from "src/utils/query-validators";

@Controller("req-transaction-headers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReqTransactionHeadersController {
  constructor(
    private readonly reqTransactionHeadersService: ReqTransactionHeadersService,
  ) {}

  @Get()
  @CacheTransactions(CACHE_KEYS.REQ_TRANSACTION_HEADERS_ALL)
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "VIEW",
  })
  async findAll() {
    return await this.reqTransactionHeadersService.findAll();
  }

  @Get("group-by-trans-number")
  @CacheTransactions(buildReqTransHeaderGroupKey)
  @RequirePermissions({
    module: "STORE REQUIREMENTS",
    action: "VIEW",
    dynamicModuleSuffix: "requirement_type_id",
  })
  async findAllByTransNumber(
    @Request() req,
    @Query() queryParams: WhReqListingDto,
  ) {
    let validatedDate: string | null = null;
    validatedDate = queryParams.date_from
      ? validateDateParam(queryParams.date_from, "date_from")
      : null;
    const dateFrom = validatedDate ? validatedDate : undefined;
    validatedDate = queryParams.date_to
      ? validateDateParam(queryParams.date_to, "date_to")
      : null;
    const dateTo = validatedDate ? validatedDate : undefined;
    const transNumber = queryParams.trans_number;
    const requirementTypeId = queryParams.requirement_type_id;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const accessKeyId = req.user?.current_access_key;
    return await this.reqTransactionHeadersService.findAllByTransNumber(
      transNumber,
      userId,
      roleId,
      accessKeyId,
      dateFrom,
      dateTo,
      Number(requirementTypeId),
    );
  }

  @Get("find-by-trans-number")
  @CacheTransactions(buildReqTransHeaderFindByTransKey)
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "VIEW",
  })
  async findOneByTransNumber(@Query() queryParams: WhReqListingDto) {
    const transNumber = queryParams.trans_number;
    return await this.reqTransactionHeadersService.findOneByTransNumber(
      transNumber,
    );
  }

  @Get(":id")
  @CacheTransactions(CACHE_KEYS.REQ_TRANSACTION_HEADERS_BY_ID)
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "VIEW",
  })
  async findOne(@Param("id") id: number) {
    return await this.reqTransactionHeadersService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "ADD",
  })
  async create(
    @Body() createDto: CreateReqTransactionHeaderDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "EDIT",
  })
  async update(
    @Param("id") id: number,
    @Body() updateDto: UpdateReqTransactionHeaderDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    return await this.reqTransactionHeadersService.update(
      id,
      updateDto,
      userId,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(id, userId);
  }

  @Patch(":trans_number/cancel-by-trans-number")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "CANCEL",
  })
  async toggleStatusCancelByTransNumber(
    @Param("trans_number") transNumber: string,
    @Body() body: { cancellation_reason: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatusCancelByTransNumber(
      transNumber,
      userId,
      body.cancellation_reason,
    );
  }

  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post("batch-create")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "ADD",
  })
  async createWithDetails(
    @Body() createDto: CreateReqTransactionWithDetailsDto,
    @Request() req,
  ) {
    const userId = req.user?.id || 1;
    const accessKeyId = req.user.current_access_key;
    return await this.reqTransactionHeadersService.createWithDetails(
      createDto,
      userId,
      accessKeyId,
    );
  }

  /**
   * Deactivate warehouse requirement due
   * Cancel requirement transaction hdr and details
   * PATCH /req-transaction-headers/toggle-status-cancel
   */
  @Patch("toggle-status-cancel")
  @RequirePermissions({
    module: ["STORE REQUIREMENTS 1", "STORE REQUIREMENTS 2"],
    action: "CANCEL",
  })
  async toggleStatusCancel(
    @Body() updateDto: CreateWarehouseRequirementDueAndReqTransDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.reqTransactionHeadersService.toggleStatus(
      updateDto.trans_header_id,
      userId,
      updateDto.status_id,
      updateDto.cancellation_reason,
    );
  }
}
