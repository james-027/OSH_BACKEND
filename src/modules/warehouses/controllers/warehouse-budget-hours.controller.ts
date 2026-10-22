import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseBudgetHoursService } from "../services/warehouse-budget-hours.service";
import { FileInterceptor, diskStorage } from "src/adapters";
import * as XLSX from "xlsx";

import * as fs from "fs";
import { extname } from "path";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { BadRequestException } from "@nestjs/common/exceptions";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import {
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "src/utils/file-upload.utils";
import { generate } from "rxjs";
import { CreateWarehouseBudgetHourDto } from "../dto/CreateWarehouseBudgetHourDto";
import { UpdateWarehouseBudgetHourDto } from "../dto/UpdateWarehouseBudgetHourDto";
import {
  ExcelValidationConfig,
  normalizeKeysArray,
  validateAndFormatExcelRow,
} from "src/utils/excel-validation";

@Controller("warehouse-budget-hours")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseBudgetHoursController {
  constructor(
    private readonly warehouseBudgetHoursService: WarehouseBudgetHoursService,
    private readonly auditTrailService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return this.warehouseBudgetHoursService.findAll(
      accessKeyId,
      userId,
      roleId,
    );
  }

  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "VIEW" })
  @Get(":id")
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseBudgetHoursService.findOne(id);
  }

  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "ADD" })
  @Post()
  async create(
    @Body() createDto: CreateWarehouseBudgetHourDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseBudgetHoursService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseBudgetHourDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseBudgetHoursService.update(id, updateDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseBudgetHoursService.toggleStatus(id, userId);
  }
  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseBudgetHoursService.toggleStatus(id, userId);
  }

  @Post("upload-excel")
  @RequirePermissions({ module: "STORE BUDGET HOURS", action: "ADD" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/warehouse-budget-hours",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }
    const workbook = XLSX.read(fs.readFileSync(file.path), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const json = normalizeKeysArray(rawRows);
    const userId = req.user.id;
    const roleId = req.user.role_id;

    // Get allowed location_ids for this user/role
    const allowedLocationIds =
      await this.commonUtilitiesService.getUserAllowedLocationIds(
        userId,
        roleId,
      );

    const excelValidationConfig: ExcelValidationConfig = {
      requiredFields: {
        "STORE BOS CODE": { format: "uppercase-trim" },
        "STORE NAME": { format: "uppercase-trim" },
        "AGENCY CODE": { format: "uppercase-trim" },
        "AGENCY NAME": { format: "trim" },
        "DATE FROM": { format: "trim" },
        "DATE TO": { format: "trim" },
        "BUDGET HOURS PER DAY": { format: "number-trim" },
        STATUS: { format: "uppercase-trim" },
      },
    };

    // Map Excel columns to DTOs
    const records = json.map((row, idx) => {
      const formattedRow = validateAndFormatExcelRow(
        row,
        excelValidationConfig,
      );
      let status = null;
      if (typeof formattedRow["STATUS"] === "string") {
        const s = formattedRow["STATUS"];
        if (s === "ACTIVE" || s === "INACTIVE") status = s;
      }
      return {
        budget_hours: formattedRow["BUDGET HOURS PER DAY"],
        budget_date_from: formattedRow["DATE FROM"],
        budget_date_to: formattedRow["DATE TO"],
        warehouse_ifs: formattedRow["STORE BOS CODE"],
        store_name: formattedRow["STORE NAME"],
        service_provider_code: formattedRow["AGENCY CODE"],
        service_provider_name: formattedRow["AGENCY NAME"],
        status,
        __rowNum__: idx + 2,
      };
    });

    // Pass allowedLocationIds to service for validation
    await this.auditTrailService.create(
      {
        service: "WarehouseBudgetHoursController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload warehouse budget hours from Excel. Rows: ${records.length}`,
        status_id: 1,
      },
      userId,
    );
    return this.warehouseBudgetHoursService.bulkUploadFromExcel(
      records,
      userId,
      allowedLocationIds,
    );
  }
}
