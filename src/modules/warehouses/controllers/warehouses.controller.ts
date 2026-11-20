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
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "DATA ACCESS",
  })
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

  @Get("/all")
  @CacheCustom(buildWarehouseKey, CACHE_TTL.COUNTS)
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "DATA ACCESS",
  })
  async findAllWarehousesNoRestriction(@Request() req) {
    const userId = req.user?.id;
    const roleId = req.user?.role_id;

    return this.warehousesService.findAll(undefined, undefined, userId, roleId);
  }

  @Get("/stores/:warehouse_type_id")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "DATA ACCESS",
  })
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
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "POST",
  })
  async toggleBulkStatus(
    @Body() bulkStatusDto: BulkChangeWarehouseStatusDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleBulkStatus(
      bulkStatusDto.ids,
      bulkStatusDto.rem_status_id,
      userId,
      bulkStatusDto.undo_reason,
    );
  }

  @Post("upload-excel")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "ADD",
  })
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

    // Get allowed location_ids and warehouse_ids for this user/role
    const [allowedLocationIds, allowedWarehouseIds] = await Promise.all([
      this.commonUtilitiesService.getUserAllowedLocationIds(
        userId,
        roleId,
        accessKeyId,
      ),
      this.commonUtilitiesService.getUserAllowedWarehouseIds(
        userId,
        roleId,
        accessKeyId,
      ),
    ]);

    const excelValidationConfig: ExcelValidationConfig = {
      requiredFields: {
        "STORE IFS": { format: "uppercase-trim" },
        "STORE CODE": { format: "uppercase-trim" },
        "STORE NAME": { format: "uppercase-trim" },
        LOCATION: { format: "uppercase-trim" },
        SEGMENT: { format: "uppercase-trim" },
        "START OPERATION DATE": { format: "trim" },
        "START TIME": { format: "trim" },
        "END TIME": { format: "trim" },
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
        "END OPERATION DATE": { format: "trim", nullable: true },
        "PROFIT CENTER": { format: "uppercase-trim", nullable: true },
        "SALES TERRITORY": { format: "uppercase-trim", nullable: true },
        "ALLOWED GEOFENCE": { format: "number-trim", nullable: true },
      },
    };

    // Map Excel columns to DTOs using validateAndFormatExcelRow
    const records = json.map((row, idx) => {
      // Support aliases (e.g., STORE BOS CODE -> STORE IFS, BRAND -> SEGMENT, LOCATION NAME / ID -> LOCATION)
      if (!row["STORE IFS"] && row["STORE BOS CODE"]) {
        row["STORE IFS"] = row["STORE BOS CODE"];
      }
      if (!row["LOCATION"] && row["LOCATION NAME"]) {
        row["LOCATION"] = row["LOCATION NAME"];
      }
      if (!row["LOCATION"] && row["LOCATION ID"]) {
        row["LOCATION"] = row["LOCATION ID"];
      }
      if (!row["SEGMENT"] && row["SEGMENT NAME"]) {
        row["SEGMENT"] = row["SEGMENT NAME"];
      }
      if (!row["SEGMENT"] && row["SEGMENT ID"]) {
        row["SEGMENT"] = row["SEGMENT ID"];
      }
      if (!row["SEGMENT"] && row["BRAND"]) {
        row["SEGMENT"] = row["BRAND"];
      }
      if (!row["SEGMENT"] && row["BRAND NAME"]) {
        row["SEGMENT"] = row["BRAND NAME"];
      }
      if (!row["SEGMENT"] && row["BRAND ID"]) {
        row["SEGMENT"] = row["BRAND ID"];
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
      if (!row["START OPERATION DATE"] && row["START OPERATION"]) {
        row["START OPERATION DATE"] = row["START OPERATION"];
      }
      if (!row["START OPERATION DATE"] && row["START_OPERATION"]) {
        row["START OPERATION DATE"] = row["START_OPERATION"];
      }
      if (!row["END OPERATION DATE"] && row["END OPERATION"]) {
        row["END OPERATION DATE"] = row["END OPERATION"];
      }
      if (!row["END OPERATION DATE"] && row["END_OPERATION"]) {
        row["END OPERATION DATE"] = row["END_OPERATION"];
      }
      if (!row["START TIME"] && row["STARTING TIME"]) {
        row["START TIME"] = row["STARTING TIME"];
      }
      if (!row["START TIME"] && row["START_TIME"]) {
        row["START TIME"] = row["START_TIME"];
      }
      if (!row["START TIME"] && row["STARTING_TIME"]) {
        row["START TIME"] = row["STARTING_TIME"];
      }
      if (!row["END TIME"] && row["ENDING TIME"]) {
        row["END TIME"] = row["ENDING TIME"];
      }
      if (!row["END TIME"] && row["END_TIME"]) {
        row["END TIME"] = row["END_TIME"];
      }
      if (!row["END TIME"] && row["ENDING_TIME"]) {
        row["END TIME"] = row["ENDING_TIME"];
      }
      if (!row["PROFIT CENTER"] && row["PROFIT CENTER CODE"]) {
        row["PROFIT CENTER"] = row["PROFIT CENTER CODE"];
      }
      if (!row["PROFIT CENTER"] && row["PROFIT CENTER NAME"]) {
        row["PROFIT CENTER"] = row["PROFIT CENTER NAME"];
      }
      if (!row["PROFIT CENTER"] && row["PROFIT CENTER ID"]) {
        row["PROFIT CENTER"] = row["PROFIT CENTER ID"];
      }
      if (!row["PROFIT CENTER"] && row["PROFIT_CENTER"]) {
        row["PROFIT CENTER"] = row["PROFIT_CENTER"];
      }
      if (!row["PROFIT CENTER"] && row["PROFIT_CENTER_ID"]) {
        row["PROFIT CENTER"] = row["PROFIT_CENTER_ID"];
      }
      if (!row["PROFIT CENTER"] && row["PROFITCENTER"]) {
        row["PROFIT CENTER"] = row["PROFITCENTER"];
      }

      if (!row["SALES TERRITORY"] && row["SALES TERRITORY NAME"]) {
        row["SALES TERRITORY"] = row["SALES TERRITORY NAME"];
      }
      if (!row["SALES TERRITORY"] && row["SALES TERRITORY DESCRIPTION"]) {
        row["SALES TERRITORY"] = row["SALES TERRITORY DESCRIPTION"];
      }
      if (!row["SALES TERRITORY"] && row["SALES TERRITORY ID"]) {
        row["SALES TERRITORY"] = row["SALES TERRITORY ID"];
      }
      if (!row["SALES TERRITORY"] && row["SALES_TERRITORY"]) {
        row["SALES TERRITORY"] = row["SALES_TERRITORY"];
      }
      if (!row["SALES TERRITORY"] && row["SALES_TERRITORY_ID"]) {
        row["SALES TERRITORY"] = row["SALES_TERRITORY_ID"];
      }
      if (!row["SALES TERRITORY"] && row["TERRITORY"]) {
        row["SALES TERRITORY"] = row["TERRITORY"];
      }

      if (!row["ALLOWED GEOFENCE"] && row["ALLOWED_GEOFENCE"]) {
        row["ALLOWED GEOFENCE"] = row["ALLOWED_GEOFENCE"];
      }
      if (!row["ALLOWED GEOFENCE"] && row["GEOFENCE"]) {
        row["ALLOWED GEOFENCE"] = row["GEOFENCE"];
      }

      const formattedRow = validateAndFormatExcelRow(
        row,
        excelValidationConfig,
      );

      return {
        warehouse_ifs: formattedRow["STORE IFS"],
        warehouse_code: formattedRow["STORE CODE"],
        warehouse_name: formattedRow["STORE NAME"],
        location: formattedRow["LOCATION"],
        segment: formattedRow["SEGMENT"],
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
        status: formattedRow["STATUS"] || STATUS_IDS.ACTIVE, // Default to ACTIVE if not provided
        rem_status: formattedRow["REM STATUS"] || null,
        pos_availability: formattedRow["POS AVAILABILITY"] || null,
        allowance: formattedRow["ALLOWANCE"]
          ? Number(formattedRow["ALLOWANCE"])
          : 0,
        start_operation: formattedRow["START OPERATION DATE"] || null,
        end_operation: formattedRow["END OPERATION DATE"] || null,
        starting_time: formattedRow["START TIME"] || null,
        ending_time: formattedRow["END TIME"] || null,
        profit_center: formattedRow["PROFIT CENTER"] || null,
        sales_territory: formattedRow["SALES TERRITORY"] || null,
        allowed_geofence:
          formattedRow["ALLOWED GEOFENCE"] !== null &&
          formattedRow["ALLOWED GEOFENCE"] !== undefined &&
          formattedRow["ALLOWED GEOFENCE"] !== ""
            ? Number(formattedRow["ALLOWED GEOFENCE"])
            : null,
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
      allowedWarehouseIds,
    );
  }

  @Get(":id")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "ADD",
  })
  async create(@Body() createDto: CreateWarehouseDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehousesService.create(
      { ...createDto, access_key_id: accessKeyId },
      userId,
    );
  }

  @Patch(":id")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.update(id, updateDto, userId);
  }

  @Patch(":id/change-status")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "POST",
  })
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
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "CANCEL",
  })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user?.id;
    return this.warehousesService.remove(id, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: ["TAKE OUT STORES", "BPLUS STORES"],
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehousesService.toggleStatus(id, userId);
  }
}
