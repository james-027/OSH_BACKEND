import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  Query,
} from "@nestjs/common";
import { SalesTransactionsService } from "../services/sales-transactions.service";
import { CreateSalesTransactionDto } from "../dto/CreateSalesTransactionDto";
import { UpdateSalesTransactionDto } from "../dto/UpdateSalesTransactionDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { DateFilterQueryDto } from "src/dto/query-params/DateFilterQueryDto";
import { validateDateParam } from "src/utils/query-validators";

@Controller("sales-transactions")
@UseGuards(JwtAuthGuard)
export class SalesTransactionsController {
  constructor(
    private readonly salesTransactionsService: SalesTransactionsService,
  ) {}

  @Get()
  async findAll(@Req() req: any, @Query() queryParams: DateFilterQueryDto) {
    const accessKeyId = req.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    // Accept sales_date as optional query param
    let validatedDate: string | null = null;
    validatedDate = queryParams.sales_date
      ? validateDateParam(queryParams.sales_date, "sales_date")
      : null;
    const sales_date = validatedDate ? validatedDate : undefined;
    return this.salesTransactionsService.findAll(
      accessKeyId,
      userId,
      roleId,
      sales_date,
    );
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES TRANSACTIONS", action: "VIEW" })
  @Get("per-location")
  async findAllPerLocation(@Req() req: any) {
    const sales_date = req.query?.sales_date ? req.query.sales_date : undefined;
    const user = req.user || {};
    return this.salesTransactionsService.findAllPerLocation(
      user.id,
      user.role_id,
      user.current_access_key,
      sales_date,
    );
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES TRANSACTIONS", action: "VIEW" })
  @Get("per-location/:location_id/:doc_date")
  async findOnePerLocation(
    @Param("location_id", ParseIntPipe) location_id: number,
    @Param("doc_date") doc_date: string,
  ) {
    return this.salesTransactionsService.findOnePerLocation(
      location_id,
      doc_date,
    );
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.salesTransactionsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateSalesTransactionDto) {
    return this.salesTransactionsService.create(createDto);
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSalesTransactionDto,
  ) {
    return this.salesTransactionsService.update(id, updateDto);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.salesTransactionsService.remove(id);
  }
}
