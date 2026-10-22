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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../guards/permissions.guard";
import { RequirePermissions } from "../../../decorators/permissions.decorator";
import { WarehouseEmployeesService } from "../services/warehouse-employees.service";
import { CreateWarehouseEmployeeDto } from "../dto/CreateWarehouseEmployeeDto";
import { UpdateWarehouseEmployeeDto } from "../dto/UpdateWarehouseEmployeeDto";
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
import * as XLSX from "xlsx";
import { WarehousesService } from "../services/warehouses.service";
import { EmployeesService } from "src/modules/employees/services/employees.service";
import { StatusService } from "../../status/services/status.service";
import * as fs from "fs";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import { CacheCustom } from "src/decorators/cache.decorator";
import { buildWarehouseEmployeeKey, CACHE_TTL } from "src/config/cache.config";
import { parseToFirstDayOfMonth } from "../../../utils/date.utils";
import { DateFilterQueryDto } from "src/dto/query-params";
import { validateDateParam } from "src/utils/query-validators";

@Controller("warehouse-employees")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseEmployeesController {
  constructor(
    private readonly warehouseEmployeesService: WarehouseEmployeesService,
    private readonly warehousesService: WarehousesService,
    private readonly employeesService: EmployeesService,
    private readonly statusService: StatusService,
    private readonly userAuditTrailCreateService: UserAuditTrailCreateService, // Inject audit trail service
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  @Get()
  @CacheCustom(buildWarehouseEmployeeKey, CACHE_TTL.COUNTS)
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "VIEW" })
  async findAll(@Request() req, @Query() queryParams: DateFilterQueryDto) {
    const accessKeyId = req.user.current_access_key;
    const userId = req.user.id;
    const roleId = req.user.role_id;
    let validatedDate: string | null = null;
    validatedDate = queryParams.assignment_date
      ? validateDateParam(queryParams.assignment_date, "assignment_date")
      : null;
    const assignment_date = validatedDate ? validatedDate : undefined;

    return this.warehouseEmployeesService.findAll(
      accessKeyId,
      userId,
      roleId,
      assignment_date,
    );
  }

  @Get("get-warehouses-with-no-record")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "DATA ACCESS" })
  async getWarehousesWithNoRecord(
    @Query("location_ids") locationIdsParam: string,
    @Query("assignment_date") assignmentDateParam: string,
  ) {
    if (!locationIdsParam || !assignmentDateParam) {
      throw new BadRequestException(
        "location_ids and assignment_date query parameters are required",
      );
    }

    // Parse comma-separated location_ids and convert to numbers
    const locationIds = locationIdsParam.split(",").map((id) => {
      const parsed = parseInt(id.trim(), 10);
      if (isNaN(parsed)) {
        throw new BadRequestException(
          `Invalid location_id: ${id}. Must be a valid number.`,
        );
      }
      return parsed;
    });

    // Validate assignment_date format
    const validatedDate = validateDateParam(
      assignmentDateParam,
      "assignment_date",
    );

    return this.warehouseEmployeesService.getWarehousesWithNoRecord(
      locationIds,
      validatedDate,
    );
  }

  @Get("history/:id")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "VIEW" })
  async findOneHistory(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseEmployeesService.findOneHistory(id);
  }

  @Get(":id")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "VIEW" })
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseEmployeesService.findOne(id);
  }

  @Post()
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "ADD" })
  async create(@Body() createDto: CreateWarehouseEmployeeDto, @Request() req) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehouseEmployeesService.create(
      { ...createDto, access_key_id: accessKeyId },
      userId,
    );
  }

  @Put(":id")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "EDIT" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateWarehouseEmployeeDto,
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehouseEmployeesService.update(
      id,
      { ...updateDto, access_key_id: accessKeyId },
      userId,
    );
  }

  @Delete(":id")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "CANCEL" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.warehouseEmployeesService.remove(id);
  }

  @Patch(":id/toggle-status-activate")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "ACTIVATE" })
  async toggleStatusActivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseEmployeesService.toggleStatus(id, userId);
  }

  @Patch(":id/toggle-status-deactivate")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "DEACTIVATE" })
  async toggleStatusDeactivate(
    @Param("id", ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userId = req.user.id;
    return this.warehouseEmployeesService.toggleStatus(id, userId);
  }

  @Post("upload")
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "ADD" })
  async bulkUpload(
    @Body() records: CreateWarehouseEmployeeDto[],
    @Request() req,
  ) {
    const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    return this.warehouseEmployeesService.bulkUpload(
      records,
      userId,
      accessKeyId,
      {
        batchSize: 100,
      },
    );
  }

  @Post("upload-excel")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/warehouse-emp",
        filename: generateTimestampFilename,
      }),
      fileFilter: excelFileFilter,
      limits: { fileSize: FILE_SIZE_LIMITS.EXCEL_8MB },
    }),
  )
  @RequirePermissions({ module: "STORE_EMPLOYEES", action: "ADD" })
  async uploadExcel(@UploadedFile() file: FileType, @Request() req) {
    if (!file) {
      throw new BadRequestException("No file uploaded or invalid file type.");
    }
    // Use disk storage: read from file.path
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
        roleId,
      );

    // Preload all warehouses, employees (with their locations), and statuses for fast lookup
    const warehouses = await this.warehousesService.findAll();
    const employees = await this.employeesService.findAll(
      undefined,
      userId,
      roleId,
    ); // Pass parameters to include locations
    const statuses = await this.statusService.findAll();

    const records: CreateWarehouseEmployeeDto[] = [];
    const errors: { row: number; error: string }[] = [];
    const rowMap: { row: number; record: any }[] = [];

    // Define interface outside the processing loop
    interface Employee {
      id: number;
      employee_number: string;
      status_id: number;
      position_abbr?: string;
      position_name?: string;
      locations?: { location_id: number; location_name: string }[];
    }

    // Pre-index warehouses into a Map for O(1) instant lookups
    const activeWarehouseMap = new Map<string, (typeof warehouses)[0]>();
    for (const w of warehouses) {
      if (w.status_id === 1 && w.warehouse_ifs) {
        activeWarehouseMap.set(String(w.warehouse_ifs).trim(), w);
      }
    }

    // Pre-index status names into a Map
    const statusMap = new Map<string, number>();
    statusMap.set("ACTIVE", 1);
    statusMap.set("INACTIVE", 2);
    if (Array.isArray(statuses)) {
      for (const s of statuses) {
        if (s.status_name) {
          statusMap.set(String(s.status_name).trim().toUpperCase(), s.id);
        }
      }
    }

    // Centralized Employee Finder Function
    const findEmployee = (
      empNo: string,
      abbrs: string[],
      warehouseLocationId: number,
      requireLocationId = false,
    ): Employee | undefined => {
      if (!empNo) return undefined;
      const cleanEmpNo = String(empNo).trim();

      return employees.find((e: any) => {
        const matchesEmpNo = e.employee_number == cleanEmpNo;
        const matchesStatus = e.status_id === 1;
        const matchesAbbr = abbrs.includes(
          (e.position_abbr || e.position_name || "").toUpperCase(),
        );

        const matchesLocation =
          !requireLocationId ||
          (Array.isArray(e.locations) &&
            e.locations.some(
              (loc: { location_id: number }) =>
                loc.location_id === warehouseLocationId,
            ));

        return matchesEmpNo && matchesStatus && matchesAbbr && matchesLocation;
      });
    };

    // Helper for repetitive Employee Role Resolution & Validation
    const resolveEmployeeRole = (
      row: Record<string, any>,
      columnKey: string,
      roleLabel: string,
      allowedAbbrs: string[],
      warehouseLocationId: number,
      options: { required: boolean; requireLocationId: boolean },
    ): number | null => {
      const rawVal = row[columnKey];
      const empNoStr = typeof rawVal === "string" ? rawVal.trim() : rawVal;

      if (!empNoStr) {
        if (options.required) {
          throw new Error(`${columnKey} is required`);
        }
        return null;
      }

      const foundEmp = findEmployee(
        empNoStr,
        allowedAbbrs,
        warehouseLocationId,
        options.requireLocationId,
      );

      if (!foundEmp) {
        const locationSuffix = options.requireLocationId
          ? " (not found or not assigned to this store's location)"
          : " (not found or not assigned to this store's location)";
        throw new Error(`Invalid ${columnKey} [${empNoStr}]${locationSuffix}`);
      }

      return foundEmp.id;
    };

    // Main Upload Processing Loop
    for (let i = 0; i < json.length; i++) {
      const row = json[i];
      const excelRowNum = i + 2; // +2 for Excel row number (header + 1-based)

      try {
        // 1. Warehouse lookup via Map (O(1))
        const rawStoreIfs = row["STORE IFS"]
          ? String(row["STORE IFS"]).trim()
          : "";
        const warehouse = activeWarehouseMap.get(rawStoreIfs);

        if (!warehouse) {
          throw new Error("Invalid or inactive STORE IFS");
        }

        // Location permission check
        if (!allowedLocationIds.includes(warehouse.location_id)) {
          throw new Error(
            `You do not have permission to upload employees for STORE IFS ${row["STORE IFS"]} (${warehouse.warehouse_name}), location_id ${warehouse.location_id}.`,
          );
        }

        const locId = warehouse.location_id;

        // 2. Employee Lookups using standardized helper
        const acId = resolveEmployeeRole(
          row,
          "ASSIGNED AC EMP. NO.",
          "AC",
          ["AC"],
          locId,
          { required: false, requireLocationId: false },
        )!;

        const ssId = resolveEmployeeRole(
          row,
          "ASSIGNED SS EMP. NO.",
          "SS",
          ["SS", "AH", "GAH", "BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: true, requireLocationId: true },
        )!;

        const ahId = resolveEmployeeRole(
          row,
          "ASSIGNED AH EMP. NO.",
          "AH",
          ["AH", "GAH", "BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: true, requireLocationId: true },
        )!;

        const bchId = resolveEmployeeRole(
          row,
          "ASSIGNED BCH EMP. NO.",
          "BCH",
          ["GAH", "BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: true, requireLocationId: true },
        )!;

        const gbchId = resolveEmployeeRole(
          row,
          "ASSIGNED GBCH EMP. NO.",
          "GBCH",
          ["BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: false, requireLocationId: true },
        );

        const rhId = resolveEmployeeRole(
          row,
          "ASSIGNED RH EMP. NO.",
          "RH",
          ["BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: true, requireLocationId: true },
        )!;

        const grhId = resolveEmployeeRole(
          row,
          "ASSIGNED GRH EMP. NO.",
          "GRH",
          ["BCH", "GBCH", "RH", "GRH"],
          locId,
          { required: false, requireLocationId: true },
        );

        // 3. Status mapping via Map lookup
        let status_id: number | undefined = undefined;
        if (row["STATUS"]) {
          const statusName = String(row["STATUS"]).trim().toUpperCase();
          status_id = statusMap.get(statusName);
          if (!status_id) {
            throw new Error("Invalid STATUS value");
          }
        }

        // 4. Assignment date mapping
        let assignment_date: string | null = null;
        if (row["ASSIGNMENT MONTH"]) {
          assignment_date = parseToFirstDayOfMonth(row["ASSIGNMENT MONTH"]);
          if (!assignment_date) {
            throw new Error(
              `Invalid ASSIGNMENT MONTH: ${row["ASSIGNMENT MONTH"]} (unable to parse date)`,
            );
          }
        }

        records.push({
          warehouse_id: warehouse.id,
          assigned_ac: acId,
          assigned_ss: ssId,
          assigned_ah: ahId,
          assigned_bch: bchId,
          assigned_gbch: gbchId,
          assigned_rh: rhId,
          assigned_grh: grhId,
          status_id,
          assignment_date,
          __rowNum__: excelRowNum,
        } as any);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        errors.push({ row: excelRowNum, error: errorMessage });
      }
    }
    // const userId = req.user.id;
    const accessKeyId = req.user.current_access_key;
    const result = await this.warehouseEmployeesService.bulkUpload(
      records,
      userId,
      accessKeyId,
      {
        batchSize: 100,
      },
    );
    // Merge mapping errors with service errors (including duplicate errors)
    result.errors = [...errors, ...(result.errors || [])];
    // Build summary message
    const summary = {
      inserted_count: result.inserted.length,
      updated_count: result.updated.length,
      inserted_row_numbers: result.inserted.map((r) => r.row),
      updated_row_numbers: result.updated.map((r) => r.row),
      errors: result.errors,
      success: result.success,
    };
    // --- Audit Trail Logging (Optimized) ---
    if (
      summary.inserted_count > 0 ||
      summary.updated_count > 0 ||
      summary.errors.length > 0
    ) {
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseEmployeesController",
          method: "uploadExcel",
          raw_data: JSON.stringify({
            file: file.originalname,
            // records: records.slice(0, 65535),
            records: records,
          }).slice(0, 65535),
          description: `Bulk upload via Excel: ${summary.inserted_count} inserted, ${summary.updated_count} updated, ${summary.errors.length} errors. Inserted rows: ${summary.inserted_row_numbers.join(", ")}. Updated rows: ${summary.updated_row_numbers.join(", ")}. Errors: ${summary.errors
            .map((e) => `Row ${e.row}: ${e.error}`)
            .join("; ")}`,
          status_id: summary.errors.length === 0 ? 1 : 2,
        },
        userId,
      );
    }
    return summary;
  }
}
