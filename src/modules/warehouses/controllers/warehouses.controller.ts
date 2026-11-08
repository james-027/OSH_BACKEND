import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Patch,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehousesService } from "../services/warehouses.service";
import { CreateWarehouseDto } from "../dto/CreateWarehouseDto";
import { UpdateWarehouseDto } from "../dto/UpdateWarehouseDto";
import { BulkChangeWarehouseStatusDto } from "../dto/BulkChangeWarehouseStatusDto";
import { CacheCustom } from "src/decorators/cache.decorator";
import { buildWarehouseKey, CACHE_TTL } from "src/config/cache.config";
import { FileInterceptor, diskStorage } from "src/adapters";
import * as XLSX from "xlsx";
import * as fs from "fs";
import {
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "src/utils/file-upload.utils";
import {
  ExcelValidationConfig,
  normalizeKeysArray,
  validateAndFormatExcelRow,
} from "src/utils/excel-validation";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { STATUS_IDS } from "src/constants/customConstants";

@Controller("warehouses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(
    private readonly warehousesService: WarehousesService,
    private readonly auditTrailService: UserAuditTrailCreateService,
    private readonly commonUtilitiesService: CommonUtilitiesService,
  ) {}

  @Get("/stores")
  @CacheCustom(buildWarehouseKey, CACHE_TTL.COUNTS)
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.warehousesService.findAll(
      undefined,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Get("/stores/:warehouse_type_id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findAllByType(
    @Param("warehouse_type_id", ParseIntPipe) warehouseTypeId: number,
    @Request() req,
  ) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.warehousesService.findAll(
      warehouseTypeId,
      accessKeyId,
      userId,
      roleId,
    );
  }

  @Post("/change-bulk-status")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "POST" })
  async toggleBulkStatus(
    @Body() bulkStatusDto: BulkChangeWarehouseStatusDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleBulkStatus(
      bulkStatusDto.ids,
      bulkStatusDto.status_id,
      userId,
      bulkStatusDto.undo_reason,
    );
  }

  @Post("upload-excel")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "ADD" })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const dir = "./uploads/warehouses";
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
    const accessKeyId = req.user.current_access_key;

    // Get allowed location_ids for this user/role
    const allowedLocationIds =
      await this.commonUtilitiesService.getUserAllowedLocationIds(
        userId,
        roleId,
        accessKeyId,
      );

    const excelValidationConfig: ExcelValidationConfig = {
      requiredFields: {
        "STORE IFS": { format: "uppercase-trim" },
        "STORE CODE": { format: "uppercase-trim" },
        "STORE NAME": { format: "uppercase-trim" },
        "LOCATION ID": { format: "number-trim" },
        "SEGMENT ID": { format: "number-trim" },
      },
      optionalFields: {
        ADDRESS: { format: "trim", nullable: true },
        LATITUDE: { format: "number-trim", nullable: true },
        LONGITUDE: { format: "number-trim", nullable: true },
        "WAREHOUSE TYPE": { format: "uppercase-trim", nullable: true },
        STATUS: { format: "uppercase-trim", nullable: true },
        "REM STATUS": { format: "uppercase-trim", nullable: true },
        "POS AVAILABILITY": { format: "uppercase-trim", nullable: true },
        ALLOWANCE: { format: "number-trim", nullable: true },
      },
    };

    // Map Excel columns to DTOs using validateAndFormatExcelRow
    const records = json.map((row, idx) => {
      // Support aliases (e.g., STORE BOS CODE -> STORE IFS, BRAND ID -> SEGMENT ID)
      if (!row["STORE IFS"] && row["STORE BOS CODE"]) {
        row["STORE IFS"] = row["STORE BOS CODE"];
      }
      if (!row["SEGMENT ID"] && row["BRAND ID"]) {
        row["SEGMENT ID"] = row["BRAND ID"];
      }
      if (!row["WAREHOUSE TYPE"] && row["STORE TYPE"]) {
        row["WAREHOUSE TYPE"] = row["STORE TYPE"];
      }
      if (!row["WAREHOUSE TYPE"] && row["WAREHOUSE TYPE ID"]) {
        row["WAREHOUSE TYPE"] = row["WAREHOUSE TYPE ID"];
      }
      if (!row["REM STATUS"] && row["REM STATUS ID"]) {
        row["REM STATUS"] = row["REM STATUS ID"];
      }
      if (!row["POS AVAILABILITY"] && row["POS AVAILABILITY ID"]) {
        row["POS AVAILABILITY"] = row["POS AVAILABILITY ID"];
      }

      const formattedRow = validateAndFormatExcelRow(
        row,
        excelValidationConfig,
      );

      return {
        warehouse_ifs: formattedRow["STORE IFS"],
        warehouse_code: formattedRow["STORE CODE"],
        warehouse_name: formattedRow["STORE NAME"],
        location_id: Number(formattedRow["LOCATION ID"]),
        segment_id: Number(formattedRow["SEGMENT ID"]),
        address: formattedRow["ADDRESS"] || "",
        latitude:
          formattedRow["LATITUDE"] !== null &&
          formattedRow["LATITUDE"] !== undefined
            ? Number(formattedRow["LATITUDE"])
            : null,
        longitude:
          formattedRow["LONGITUDE"] !== null &&
          formattedRow["LONGITUDE"] !== undefined
            ? Number(formattedRow["LONGITUDE"])
            : null,
        warehouse_type: formattedRow["WAREHOUSE TYPE"] || null,
        status: formattedRow["STATUS"] || null,
        rem_status: formattedRow["REM STATUS"] || null,
        pos_availability: formattedRow["POS AVAILABILITY"] || null,
        allowance: formattedRow["ALLOWANCE"]
          ? Number(formattedRow["ALLOWANCE"])
          : 0,
        __rowNum__: idx + 2,
      };
    });

    // Pass allowedLocationIds to service for validation
    await this.auditTrailService.create(
      {
        service: "WarehousesController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload warehouses from Excel. Rows: ${records.length}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    return this.warehousesService.bulkUploadFromExcel(
      records,
      userId,
      allowedLocationIds,
      accessKeyId,
      file.originalname,
    );
  }

  @Get(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "ADD" })
  async create(@Body() createDto: CreateWarehouseDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehousesService.create(
      { ...createDto, access_key_id: accessKeyId },
      userId,
    );
  }

  @Patch(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.update(id, updateDto, userId);
  }

  @Patch(":id/change-status")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "POST" })
  async changeStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status_id: number; undo_reason?: string },
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.changeRemStatus(
      id,
      body.status_id,
      userId,
      body.undo_reason,
    );
  }

  @Delete(":id")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user?.id;
    return this.warehousesService.remove(id, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "TAKEOUTSTORES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }
}
