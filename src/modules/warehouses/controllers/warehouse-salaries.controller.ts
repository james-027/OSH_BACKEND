import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseSalariesService } from "../services/warehouse-salaries.service";
import { FileInterceptor, diskStorage } from "src/adapters";
import * as XLSX from "xlsx";

import * as fs from "fs";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { BadRequestException } from "@nestjs/common/exceptions";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import {
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "src/utils/file-upload.utils";
import { CreateWarehouseSalaryDto } from "../dto/CreateWarehouseSalaryDto";
import { UpdateWarehouseSalaryDto } from "../dto/UpdateWarehouseSalaryDto";
import {
  ExcelValidationConfig,
  normalizeKeysArray,
  validateAndFormatExcelRow,
} from "src/utils/excel-validation";
import { STATUS_IDS } from "src/constants/customConstants";

@Controller("warehouse-salaries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseSalariesController {
  constructor(
    private readonly warehouseSalariesService: WarehouseSalariesService,
    private readonly auditTrailService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE SALARIES", action: "VIEW" })
  async findAll(
    @Query("status_id") statusId?: string,
    @Query("hide_historical") hideHistorical?: string,
    @Request() req?: any,
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    const parsedStatusId = statusId
      ? statusId.split(",").map(Number)
      : undefined;
    return this.warehouseSalariesService.findAll(
      accessKeyId,
      userId,
      roleId,
      parsedStatusId,
      hideHistorical === "1" ? true : false,
    );
  }

  @Get("history/:id")
  @RequirePermissions({ module: "STORE SALARIES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseSalariesService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE SALARIES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseSalariesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STORE SALARIES", action: "ADD" })
  async create(@Body() createDto: CreateWarehouseSalaryDto, @Request() req) {
    const userId = req.user.id;
    return this.warehouseSalariesService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE SALARIES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseSalaryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseSalariesService.update(id, updateDto, userId);
  }

  @Post("/change-bulk-status")
  @RequirePermissions({ module: "STORE SALARIES", action: ["POST", "APPROVE"] })
  async toggleBulkStatus(
    @Body() body: { ids: number[]; status_id: number; undo_reason?: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    const { ids, status_id, undo_reason } = body;
    if (!Array.isArray(ids) || typeof status_id !== "number") {
      throw new BadRequestException(
        "Invalid payload: ids and status_id are required.",
      );
    }
    return this.warehouseSalariesService.toggleBulkStatus(
      ids,
      status_id,
      userId,
      undo_reason,
    );
  }

  @Patch(":id/toggle-status-approved")
  @RequirePermissions({ module: "STORE SALARIES", action: "APPROVE" })
  async toggleStatusApproved(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseSalariesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.APPROVED,
    );
  }

  @Patch(":id/toggle-status-for-approval")
  @RequirePermissions({ module: "STORE SALARIES", action: "EDIT" })
  async toggleStatusForApproval(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseSalariesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.FOR_APPROVAL,
    );
  }

  @Patch(":id/toggle-status-back-to-pending")
  @RequirePermissions({ module: "STORE SALARIES", action: "REVERT" })
  async toggleStatusBackToPending(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { undo_reason?: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    const undo_reason = body?.undo_reason || null;
    return this.warehouseSalariesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.PENDING,
      undo_reason,
    );
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE SALARIES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseSalariesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.ACTIVE,
    );
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE SALARIES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseSalariesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.INACTIVE,
    );
  }

  @Post("upload-excel")
  @RequirePermissions({ module: "STORE SALARIES", action: "ADD" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = "./uploads/warehouse-salaries";
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
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
        POSITION: { format: "trim" },
        "EFFECTIVITY DATE FROM": { format: "trim" },
        SALARY: { format: "number-trim" },
      },
      optionalFields: {
        "EFFECTIVITY DATE TO": { format: "trim", nullable: true },
        STATUS: { format: "uppercase-trim", nullable: true },
      },
    };

    // Map Excel columns to DTOs
    const records = json.map((row, idx) => {
      const formattedRow = validateAndFormatExcelRow(
        row,
        excelValidationConfig,
      );
      return {
        salary: formattedRow["SALARY"],
        date_from: formattedRow["EFFECTIVITY DATE FROM"],
        date_to: formattedRow["EFFECTIVITY DATE TO"] || null,
        warehouse_ifs: formattedRow["STORE BOS CODE"],
        store_name: formattedRow["STORE NAME"],
        service_provider_code: formattedRow["AGENCY CODE"],
        service_provider_name: formattedRow["AGENCY NAME"],
        position_name: formattedRow["POSITION"],
        status: formattedRow["STATUS"] || null,
        __rowNum__: idx + 2,
      };
    });

    // Pass allowedLocationIds to service for validation
    await this.auditTrailService.create(
      {
        service: "WarehouseSalariesController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload warehouse salaries from Excel. Rows: ${records.length}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );
    return this.warehouseSalariesService.bulkUploadFromExcel(
      records,
      userId,
      allowedLocationIds,
    );
  }
}
