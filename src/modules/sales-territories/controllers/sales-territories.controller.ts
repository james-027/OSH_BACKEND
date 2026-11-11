import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { SalesTerritoriesService } from "../services/sales-territories.service";
import { CreateSalesTerritoryDto } from "../dto/CreateSalesTerritoryDto";
import { UpdateSalesTerritoryDto } from "../dto/UpdateSalesTerritoryDto";
import { FileInterceptor, diskStorage } from "../../../adapters";
import * as XLSX from "xlsx";
import * as fs from "fs";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import {
  excelFileFilter,
  FILE_SIZE_LIMITS,
  generateTimestampFilename,
} from "../../../utils/file-upload.utils";
import {
  validateAndFormatExcelRow,
  normalizeKeysArray,
  ExcelValidationConfig,
} from "../../../utils/excel-validation";
import { STATUS_IDS } from "../../../constants/customConstants";

@Controller("sales-territories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalesTerritoriesController {
  constructor(
    private readonly salesTerritoriesService: SalesTerritoriesService,
    private readonly auditTrailService: UserAuditTrailCreateService,
  ) {}

  @Get()
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "DATA ACCESS",
  })
  async findAll(@Request() req, @Query("status_id") statusId?: string) {
    const accessKeyId = req.user?.current_access_key;
    const parsedStatusId = statusId ? parseInt(statusId, 10) : undefined;
    return this.salesTerritoriesService.findAll(accessKeyId, parsedStatusId);
  }

  @Get(":id")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "VIEW",
  })
  async findOne(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const accessKeyId = req.user?.current_access_key;
    return this.salesTerritoriesService.findOne(id, accessKeyId);
  }

  @Post()
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "ADD",
  })
  async create(
    @Body() createSalesTerritoryDto: CreateSalesTerritoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId =
      createSalesTerritoryDto.access_key_id || req.user?.current_access_key;
    return this.salesTerritoriesService.create(
      createSalesTerritoryDto,
      userId,
      accessKeyId,
    );
  }

  @Put(":id")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "EDIT",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateSalesTerritoryDto: UpdateSalesTerritoryDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId =
      updateSalesTerritoryDto.access_key_id || req.user?.current_access_key;
    return this.salesTerritoriesService.update(
      id,
      updateSalesTerritoryDto,
      userId,
      accessKeyId,
    );
  }

  @Delete(":id")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "CANCEL",
  })
  async remove(@Param("id", ParseIntPipe) id: number, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    return this.salesTerritoriesService.remove(id, userId, accessKeyId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "ACTIVATE",
  })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    return this.salesTerritoriesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.ACTIVE,
      accessKeyId,
    );
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "DEACTIVATE",
  })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user?.current_access_key;
    return this.salesTerritoriesService.toggleStatus(
      id,
      userId,
      STATUS_IDS.INACTIVE,
      accessKeyId,
    );
  }

  @Post("upload-excel")
  @RequirePermissions({
    module: ["SALES TERRITORY"],
    action: "ADD",
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = "./uploads/sales-territories";
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
    const accessKeyId = req.user?.current_access_key;

    const excelValidationConfig: ExcelValidationConfig = {
      requiredFields: {
        "SALES TERRITORY": { format: "trim" },
      },
      optionalFields: {
        STATUS: { format: "uppercase-trim", nullable: true },
        "ACCESS KEY ID": { format: "number-trim", nullable: true },
      },
    };

    // Normalize column aliases
    for (const row of json) {
      if (!row["SALES TERRITORY"] && row["DESCRIPTION"]) {
        row["SALES TERRITORY"] = row["DESCRIPTION"];
      }
      if (!row["SALES TERRITORY"] && row["TERRITORY"]) {
        row["SALES TERRITORY"] = row["TERRITORY"];
      }
      if (!row["SALES TERRITORY"] && row["SALES_TERRITORY"]) {
        row["SALES TERRITORY"] = row["SALES_TERRITORY"];
      }
      if (!row["SALES TERRITORY"] && row["SALES TERRITORY DESCRIPTION"]) {
        row["SALES TERRITORY"] = row["SALES TERRITORY DESCRIPTION"];
      }
      if (!row["SALES TERRITORY"] && row["NAME"]) {
        row["SALES TERRITORY"] = row["NAME"];
      }
      if (!row["ACCESS KEY ID"] && row["ACCESS_KEY_ID"]) {
        row["ACCESS KEY ID"] = row["ACCESS_KEY_ID"];
      }
      if (!row["ACCESS KEY ID"] && row["ACCESS KEY"]) {
        row["ACCESS KEY ID"] = row["ACCESS KEY"];
      }
    }

    const records = json.map((row, idx) => {
      const formattedRow = validateAndFormatExcelRow(
        row,
        excelValidationConfig,
      );

      return {
        description: formattedRow["SALES TERRITORY"],
        status: formattedRow["STATUS"] || STATUS_IDS.ACTIVE,
        access_key_id:
          formattedRow["ACCESS KEY ID"] !== null &&
          formattedRow["ACCESS KEY ID"] !== undefined &&
          formattedRow["ACCESS KEY ID"] !== ""
            ? Number(formattedRow["ACCESS KEY ID"])
            : (accessKeyId ?? null),
        __rowNum__: idx + 2,
      };
    });

    await this.auditTrailService.create(
      {
        service: "SalesTerritoriesController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload sales territories from Excel. Rows: ${records.length}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    return this.salesTerritoriesService.bulkUploadFromExcel(
      records,
      userId,
      accessKeyId,
    );
  }
}
