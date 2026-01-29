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
  BadRequestException,
  UseInterceptors,
} from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermissions } from "../decorators/permissions.decorator";
import { LocationHurdlesService } from "../services/location-hurdles.service";
import { CreateLocationHurdleDto } from "../dto/CreateLocationHurdleDto";
import { UpdateLocationHurdleDto } from "../dto/UpdateLocationHurdleDto";
import {
  FileInterceptor,
  diskStorage,
  UploadedFile as FileType,
} from "../adapters";
import { excelFileFilter, FILE_SIZE_LIMITS } from "../utils/file-upload.utils";
import * as XLSX from "xlsx";
import * as fs from "fs";
import { UserAuditTrailCreateService } from "../services/user-audit-trail-create.service";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

@Controller("location-hurdles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationHurdlesController {
  constructor(
    private readonly locationHurdlesService: LocationHurdlesService,
    private readonly auditTrailService: UserAuditTrailCreateService,
  ) {}

  @Get()
  @RequirePermissions({ module: "LOCATION HURDLES", action: "VIEW" })
  async findAll(@Request() req) {
    const userId = req.user.id;
    const roleId = req.user.role_id;
    return this.locationHurdlesService.findAll(undefined, userId, roleId);
  }

  @Get("history/:id")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.locationHurdlesService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.locationHurdlesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "LOCATION HURDLES", action: "ADD" })
  async create(@Body() createDto: CreateLocationHurdleDto, @Request() req) {
    const userId = req.user.id;
    return this.locationHurdlesService.create(createDto, userId);
  }

  @Put(":id")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateLocationHurdleDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.locationHurdlesService.update(id, updateDto, userId);
  }

  @Delete(":id")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.locationHurdlesService.remove(id);
  }

  @Post("/change-bulk-status")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "ADD" })
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
    return this.locationHurdlesService.toggleBulkStatus(
      ids,
      status_id,
      userId,
      undo_reason,
    );
  }

  @Patch(":id/toggle-status-approved")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "APPROVE" })
  async toggleStatusApproved(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 7; // Approved status
    return this.locationHurdlesService.toggleStatus(id, userId, status_id);
  }

  @Patch(":id/toggle-status-back-to-pending")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "ACTIVATE" })
  async toggleStatusBackToPending(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 3; // Pending status
    const undo_reason = body.undo_reason || null;
    return this.locationHurdlesService.toggleStatus(
      id,
      userId,
      status_id,
      undo_reason,
    );
  }

  @Patch(":id/toggle-status-for-approval")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "EDIT" })
  async toggleStatusForApproval(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 6; // For Approval status
    return this.locationHurdlesService.toggleStatus(id, userId, status_id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 2; // Active status
    return this.locationHurdlesService.toggleStatus(id, userId, status_id);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "LOCATION HURDLES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req,
  ) {
    const userId = req.user.id;
    const status_id = 2; // Inactive status
    return this.locationHurdlesService.toggleStatus(id, userId, status_id);
  }

  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/location-hurdles",
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = file.originalname.split(".").pop();
          cb(null, `${uniqueSuffix}.${ext}`);
        },
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  async uploadExcel(@UploadedFile() file: FileType, @Request() req) {
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
      await this.locationHurdlesService.getAllowedLocationIds(userId, roleId);
    // Map Excel columns to DTOs
    const records = json.map((row) => {
      let hurdle_date = null;
      const excelDate = row["HURDLE MONTH"];
      let year, month;
      if (typeof excelDate === "number") {
        // Excel serial date
        const parsed = XLSX.SSF.parse_date_code(excelDate);
        if (parsed) {
          year = parsed.y;
          month = String(parsed.m).padStart(2, "0");
        }
      } else if (typeof excelDate === "string" && excelDate) {
        // Use dayjs UTC for robust parsing
        const d = dayjs.utc(excelDate);
        if (d.isValid()) {
          year = d.year();
          month = String(d.month() + 1).padStart(2, "0");
        }
      }
      if (year && month) {
        hurdle_date = `${year}-${month}-01`;
      }
      return {
        ss_hurdle_qty:
          row["HURDLE QTY"] !== null && row["HURDLE QTY"] !== undefined
            ? Number(row["HURDLE QTY"])
            : null,
        hurdle_date,
        location_name: row["LOCATION NAME"],
        location_code: row["LOCATION CODE"],
        item_category_code: row["ITEM CATEGORY CODE"],
        location_rate: row["LOCATION RATE"],
      };
    });

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "LocationHurdlesController",
        method: "uploadExcel",
        raw_data: JSON.stringify(records).slice(0, 65535),
        description: `Bulk upload location hurdles from Excel. Rows: ${records.length}`,
        status_id: 1,
      },
      userId,
    );
    return this.locationHurdlesService.bulkUploadFromExcel(
      records,
      userId,
      allowedLocationIds,
    );
  }
}
