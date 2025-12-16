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
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { WarehouseRatesService } from "../services/warehouse-rates.service";
import { CreateWarehouseRateDto } from "../dto/CreateWarehouseRateDto";
import { UpdateWarehouseRateDto } from "../dto/UpdateWarehouseRateDto";
import { FileInterceptor } from "@nestjs/platform-express";
import * as XLSX from "xlsx";
import { diskStorage } from "multer";
import * as fs from "fs";
import { extname } from "path";
import { UserAuditTrailCreateService } from "../services/user-audit-trail-create.service";
import { BadRequestException } from "@nestjs/common/exceptions";
import { CommonUtilitiesService } from "src/services/common-utilities.service";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

@Controller("warehouse-rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseRatesController {
  constructor(
    private readonly warehouseRatesService: WarehouseRatesService,
    private readonly auditTrailService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService
  ) {}

  @Get()
  @RequirePermissions({ module: "STORE RATES", action: "VIEW" })
  async findAll(@Request() req) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return this.warehouseRatesService.findAll(accessKeyId, userId, roleId);
  }

  @RequirePermissions({ module: "STORE RATES", action: "VIEW" })
  @Get(":id")
  @RequirePermissions({ module: "STORE RATES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseRatesService.findOne(id);
  }

  @RequirePermissions({ module: "STORE RATES", action: "ADD" })
  @Post()
  async create(@Body() createDto: CreateWarehouseRateDto, @Request() req) {
    const userId = req.user.id;
    return this.warehouseRatesService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE RATES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseRateDto,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRatesService.update(id, updateDto, userId);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE RATES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRatesService.toggleStatus(id, userId);
  }
  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE RATES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.warehouseRatesService.toggleStatus(id, userId);
  }

  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/warehouse-rates",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return cb(
            new BadRequestException("Only Excel files are allowed!"),
            false
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    })
  )
  async uploadExcel(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }
    const workbook = XLSX.read(fs.readFileSync(file.path), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const userId = req.user.id;
    const roleId = req.user.role_id;

    // Get allowed location_ids for this user/role
    const allowedLocationIds =
      await this.commonUtilitiesService.getUserAllowedLocationIds(
        userId,
        roleId
      );

    // Map Excel columns to DTOs
    const records = json.map((row, idx) => {
      let status = null;
      if (typeof row["STATUS"] === "string") {
        const s = row["STATUS"].trim().toUpperCase();
        if (s === "ACTIVE" || s === "INACTIVE") status = s;
      }
      return {
        warehouse_rate:
          row["RATES"] !== null && row["RATES"] !== undefined
            ? Number(row["RATES"])
            : null,
        warehouse_ifs: row["STORE IFS"],
        store_name: row["STORE NAME"],
        status,
        __rowNum__: idx + 2,
      };
    });

    // Pass allowedLocationIds to service for validation
    await this.auditTrailService.create(
      {
        service: "WarehouseRatesController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload warehouse rates from Excel. Rows: ${records.length}`,
        status_id: 1,
      },
      userId
    );
    return this.warehouseRatesService.bulkUploadFromExcel(
      records,
      userId,
      allowedLocationIds
    );
  }
}
