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
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { SalesTransactionsService } from "../services/sales-transactions.service";
import { CreateSalesTransactionDto } from "../dto/CreateSalesTransactionDto";
import { UpdateSalesTransactionDto } from "../dto/UpdateSalesTransactionDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { PermissionsGuard } from "src/guards/permissions.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { DateFilterQueryDto } from "src/dto/query-params/DateFilterQueryDto";
import { validateDateParam } from "src/utils/query-validators";
import {
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "src/utils/file-upload.utils";
import { diskStorage, FileInterceptor } from "src/adapters";

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

  /**
   * Upload Excel file with sales transactions
   * Expected columns: SALES MONTH, BUSINESS CENTER, U_DIVISION, CODE, STORE, U_DCHANNEL,
   *                   ITEMCODE, ITEM, VATCODE, GROSSSALES, NETSALES, QUANTITY, LINE TOTAL,
   *                   UNITPRICE, VATAMOUNT, LINECOST, ITEMCOST, DISCAMOUNT, VATRATE
   *
   * FILE_LOCATION: ./uploads/sales-transactions/
   * NAMING: {timestamp}-{randomId}.{ext}
   *
   * Returns: { success: number, failed: number, message: string }
   */
  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/sales-transactions",
        filename: generateTimestampFilename, // ← Uses timestamp + random ID
      }),
      fileFilter: excelFileFilter, // ← Only allows .xlsx, .xls, .csv
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB }, // ← Max 8MB
    }),
  )
  async uploadSalesTransactions(
    @UploadedFile() file: any,
    @Request() req: any,
  ) {
    // Step 1: Validate file upload
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }

    const userId = req.user?.id;
    const accessKeyId = req.user?.current_access_key;

    if (!userId || !accessKeyId) {
      throw new BadRequestException("User authentication data missing");
    }

    // Step 2: Process uploaded file
    return this.salesTransactionsService.processUploadedSalesTransactions(
      file.path, // ← Full file path saved by multer
      userId,
      accessKeyId,
    );
  }
}
