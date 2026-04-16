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
  UploadedFile,
  BadRequestException,
  Query,
} from "@nestjs/common";
import { SalesBudgetTransactionsService } from "../services/sales-budget-transactions.service";
import { CreateSalesBudgetTransactionDto } from "../dto/CreateSalesBudgetTransactionDto";
import { UpdateSalesBudgetTransactionDto } from "../dto/UpdateSalesBudgetTransactionDto";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import { RequirePermissions } from "src/decorators/permissions.decorator";
import { PermissionsGuard } from "src/guards/permissions.guard";
import * as XLSX from "xlsx";
import { UseInterceptors } from "@nestjs/common";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../../../adapters";
import {
  excelFileFilter,
  generateTimestampFilename,
  FILE_SIZE_LIMITS,
} from "../../../utils/file-upload.utils";
import * as fs from "fs";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { DateFilterQueryDto } from "src/dto/query-params/DateFilterQueryDto";
import { validateNumericParam } from "src/utils/query-validators";

@Controller("sales-budget-transactions")
@UseGuards(JwtAuthGuard)
export class SalesBudgetTransactionsController {
  constructor(
    private readonly salesBudgetTransactionsService: SalesBudgetTransactionsService,
    private readonly userAuditTrailCreateService: UserAuditTrailCreateService,
  ) {}

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES BUDGET TRANSACTIONS", action: "VIEW" })
  @Get()
  async findAll(@Req() req: any) {
    const accessKeyId = req.user?.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;
    // Accept sales_year as optional query param
    const sales_year = req.query?.sales_year
      ? Number(req.query.sales_year)
      : undefined;
    return this.salesBudgetTransactionsService.findAll(
      accessKeyId,
      userId,
      roleId,
      sales_year !== undefined ? sales_year : new Date().getFullYear() - 1,
    );
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES BUDGET TRANSACTIONS", action: "VIEW" })
  @Get("per-location")
  async findAllPerLocation(
    @Req() req: any,
    @Query() queryParams: DateFilterQueryDto,
  ) {
    const user = req.user || {};
    let validatedDate: number | null = null;
    validatedDate = queryParams.sales_year
      ? validateNumericParam(queryParams.sales_year, "sales_year")
      : null;
    const sales_year = validatedDate || undefined;
    return this.salesBudgetTransactionsService.findAllPerLocation(
      user.id,
      user.role_id,
      user.current_access_key,
      sales_year !== undefined ? sales_year : new Date().getFullYear() - 1,
    );
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES BUDGET TRANSACTIONS", action: "VIEW" })
  @Get("per-location/:location_id/:sales_date")
  async findOnePerLocation(
    @Param("location_id", ParseIntPipe) location_id: number,
    @Param("sales_date") sales_date: string,
  ) {
    return this.salesBudgetTransactionsService.findOnePerLocation(
      location_id,
      sales_date,
    );
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.salesBudgetTransactionsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateSalesBudgetTransactionDto) {
    return this.salesBudgetTransactionsService.create(createDto);
  }

  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSalesBudgetTransactionDto,
  ) {
    return this.salesBudgetTransactionsService.update(id, updateDto);
  }

  @Delete(":id")
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.salesBudgetTransactionsService.remove(id);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES BUDGET TRANSACTIONS", action: "ADD" })
  @Post("upload-batch")
  async uploadBatch(@Body() body: { rows: any[] }, @Req() req: any) {
    // rows: array of Excel rows, each with __rowNum__
    const user = req.user || {};
    // Pass user.id, user.role_id, user.current_access_key
    return this.salesBudgetTransactionsService.uploadBatch(body.rows, {
      id: user.id,
      role_id: user.role_id,
      current_access_key: user.current_access_key,
    });
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions({ module: "SALES BUDGET TRANSACTIONS", action: "ADD" })
  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/sales-budget-trans",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadExcel(@UploadedFile() file: FileType, @Req() req: any) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }
    const workbook = XLSX.read(fs.readFileSync(file.path), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    // Add __rowNum__ for error reporting (Excel row = index+2)
    const jsonWithRowNum = json.map((row, idx) =>
      Object.assign({}, row, { __rowNum__: idx + 2 }),
    );
    const user = req.user || {};
    const summary = await this.salesBudgetTransactionsService.uploadBatch(
      jsonWithRowNum,
      {
        id: user.id,
        role_id: user.role_id,
        current_access_key: user.current_access_key,
      },
    );
    // --- Audit Trail Logging ---
    await this.userAuditTrailCreateService.create(
      {
        service: "SalesBudgetTransactionsController",
        method: "uploadExcel",
        raw_data: JSON.stringify({
          file: file.originalname,
          jsonWithRowNum: jsonWithRowNum.slice(0, 65535),
        }),
        description: `Sales Budget upload via Excel: ${summary.inserted_count} inserted, ${summary.updated_count} updated, ${summary.errors.length} errors.`,
        status_id: summary.errors.length === 0 ? 1 : 2,
      },
      user.id,
    );
    return summary;
  }
}
