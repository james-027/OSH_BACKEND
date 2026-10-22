import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateWarehouseBudgetHourDto } from "../dto/CreateWarehouseBudgetHourDto";
import { UpdateWarehouseBudgetHourDto } from "../dto/UpdateWarehouseBudgetHourDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { WarehousesService } from "./warehouses.service";
import { UsersService } from "../../users/services/users.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { WarehouseBudgetHour } from "src/entities/WarehouseBudgetHour";
import { Vendor } from "src/entities/Vendor";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
// dayjs.extend(utc);
// import dayjs from "dayjs";
// import utc = require("dayjs/plugin/utc");
import customParseFormat from "dayjs/plugin/customParseFormat";
import { parseExcelDateToYMD } from "src/utils/date.utils";
dayjs.extend(utc);
// dayjs.extend(customParseFormat);

@Injectable()
export class WarehouseBudgetHoursService {
  constructor(
    @InjectRepository(WarehouseBudgetHour)
    private warehouseBudgetHoursRepository: Repository<WarehouseBudgetHour>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private auditTrailService: UserAuditTrailCreateService,
    private warehousesService: WarehousesService,
    private usersService: UsersService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  private async resolveVendorId(vendor_id?: number): Promise<number> {
    if (vendor_id === undefined || vendor_id === null) {
      throw new NotFoundException("vendor_id is required.");
    }
    const vendor = await this.vendorsRepository.findOne({
      where: { id: vendor_id },
    });
    if (!vendor) throw new NotFoundException("Vendor not found");
    return vendor.id;
  }

  private async findOverlappingBudgetHour(
    warehouse_id: number,
    vendor_id: number,
    budget_date_from: string,
    budget_date_to: string,
    excludeId?: number,
  ): Promise<WarehouseBudgetHour | null> {
    const query = this.warehouseBudgetHoursRepository
      .createQueryBuilder("wbh")
      .where("wbh.warehouse_id = :warehouse_id", { warehouse_id })
      .andWhere("wbh.vendor_id = :vendor_id", { vendor_id })
      .andWhere("wbh.budget_date_from <= :budget_date_to", { budget_date_to })
      .andWhere("wbh.budget_date_to >= :budget_date_from", {
        budget_date_from,
      });
    if (excludeId !== undefined) {
      query.andWhere("wbh.id != :excludeId", { excludeId });
    }
    return query.getOne();
  }

  /**
   * Generic reusable lookup for budget hours per warehouse/vendor/date.
   * Returns a map keyed by `${vendor_id}-${warehouse_id}-${YYYY-MM-DD}` → WarehouseBudgetHour.
   * date = YYYY-MM-DD (local PH). Rows match when date BETWEEN budget_date_from AND budget_date_to and status=ACTIVE.
   * Passes calling-detail as pre-built requests to keep the helper entity-agnostic and reusable by any service.
   */
  async getBudgetHoursMap(
    requests: Array<{ vendor_id: number; warehouse_id: number; date: string }>,
  ): Promise<Map<string, WarehouseBudgetHour>> {
    const keys = new Set<string>();
    for (const r of requests) {
      if (r.vendor_id != null && r.warehouse_id != null && r.date) {
        keys.add(`${r.vendor_id}-${r.warehouse_id}-${r.date}`);
      }
    }
    if (keys.size === 0) return new Map();
    const vendorIds = [
      ...new Set([...keys].map((k) => Number(k.split("-")[0]))),
    ];
    const warehouseIds = [
      ...new Set([...keys].map((k) => Number(k.split("-")[1]))),
    ];
    const filtered = await this.warehouseBudgetHoursRepository
      .createQueryBuilder("wbh")
      .where("wbh.vendor_id IN (:...vendorIds)", { vendorIds })
      .andWhere("wbh.warehouse_id IN (:...warehouseIds)", { warehouseIds })
      .andWhere("wbh.status_id = :statusId", { statusId: 1 })
      .getMany();
    const map = new Map<string, WarehouseBudgetHour>();
    for (const row of filtered) {
      const dateFrom = row.budget_date_from as unknown as string;
      const dateTo = row.budget_date_to as unknown as string;
      for (const k of [...keys]) {
        const [dvId, dwId, ...dRest] = k.split("-");
        const dIso = dRest.join("-");
        if (
          String(row.vendor_id) === String(dvId) &&
          String(row.warehouse_id) === String(dwId) &&
          dIso >= dateFrom &&
          dIso <= dateTo
        ) {
          if (!map.has(k)) map.set(k, row);
        }
      }
    }
    return map;
  }

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
  ): Promise<any[]> {
    let allowedLocationIds: number[] | undefined = undefined;
    if (userId && roleId) {
      const userLocations = await this.usersService[
        "userLocationsRepository"
      ].find({
        where: { user_id: userId, role_id: roleId, status_id: 1 },
        select: ["location_id"],
      });
      allowedLocationIds = userLocations.map((ul) => ul.location_id);
    }
    const query = this.warehouseBudgetHoursRepository
      .createQueryBuilder("wbh")
      .innerJoinAndSelect("wbh.warehouse", "warehouse")
      .innerJoinAndSelect("warehouse.location", "location")
      .innerJoinAndSelect("wbh.status", "status")
      .innerJoinAndSelect("wbh.createdBy", "createdBy")
      .leftJoinAndSelect("wbh.updatedBy", "updatedBy")
      .leftJoinAndSelect("wbh.vendor", "vendor");
    if (accessKeyId !== undefined) {
      query.andWhere("warehouse.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    const budgetHours = await query.getMany();
    return budgetHours.map((budgetHour) => ({
      id: budgetHour.id,
      warehouse_id: budgetHour.warehouse_id,
      warehouse_ifs: budgetHour.warehouse?.warehouse_ifs,
      warehouse_name: budgetHour.warehouse?.warehouse_name,
      location_id: budgetHour.warehouse
        ? budgetHour.warehouse.location_id
        : null,
      location_name:
        budgetHour.warehouse && budgetHour.warehouse.location
          ? budgetHour.warehouse.location.location_name
          : null,
      budget_hours: budgetHour.budget_hours,
      budget_date_from: budgetHour.budget_date_from,
      budget_date_to: budgetHour.budget_date_to,
      vendor_id: budgetHour.vendor_id,
      vendor_name: budgetHour.vendor?.service_provider_name,
      vendor_code: budgetHour.vendor?.service_provider_code,
      status_id: budgetHour.status_id,
      status_name: budgetHour.status?.status_name,
      created_at: budgetHour.created_at,
      created_by: budgetHour.created_by,
      updated_by: budgetHour.updated_by,
      modified_at: budgetHour.updated_at,
      created_user: budgetHour.createdBy
        ? `${budgetHour.createdBy.first_name} ${budgetHour.createdBy.last_name}`
        : null,
      updated_user: budgetHour.updatedBy
        ? `${budgetHour.updatedBy.first_name} ${budgetHour.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const budgetHour = await this.warehouseBudgetHoursRepository.findOne({
      where: { id },
      relations: ["warehouse", "status", "createdBy", "updatedBy", "vendor"],
    });
    if (!budgetHour)
      throw new NotFoundException("Warehouse budget hour not found");
    return {
      id: budgetHour.id,
      warehouse_id: budgetHour.warehouse_id,
      warehouse_name: budgetHour.warehouse?.warehouse_name,
      budget_hours: budgetHour.budget_hours,
      budget_date_from: budgetHour.budget_date_from,
      budget_date_to: budgetHour.budget_date_to,
      vendor_id: budgetHour.vendor_id,
      vendor_name: budgetHour.vendor?.service_provider_name,
      vendor_code: budgetHour.vendor?.service_provider_code,
      status_id: budgetHour.status_id,
      status_name: budgetHour.status?.status_name,
      created_at: budgetHour.created_at,
      created_by: budgetHour.created_by,
      updated_by: budgetHour.updated_by,
      modified_at: budgetHour.updated_at,
      created_user: budgetHour.createdBy
        ? `${budgetHour.createdBy.first_name} ${budgetHour.createdBy.last_name}`
        : null,
      updated_user: budgetHour.updatedBy
        ? `${budgetHour.updatedBy.first_name} ${budgetHour.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createDto: CreateWarehouseBudgetHourDto,
    userId: number,
  ): Promise<any> {
    const { warehouse_ids, vendor_ids, budget_hours, status_id } = createDto;
    const results = [];
    const errorMessages: string[] = [];
    // Resolve and validate all vendor ids up front (DTO already requires non-empty)
    const resolvedVendorIds: number[] = [];
    for (const vendor_id of vendor_ids) {
      resolvedVendorIds.push(await this.resolveVendorId(vendor_id));
    }
    // Cross-product: every warehouse x every vendor gets its own entry + overlap check
    for (const warehouse_id of warehouse_ids) {
      for (const resolvedVendorId of resolvedVendorIds) {
        // Check for overlapping budget (warehouse_id + vendor_id + date range)
        const exists = await this.findOverlappingBudgetHour(
          warehouse_id,
          resolvedVendorId,
          createDto.budget_date_from,
          createDto.budget_date_to,
        );
        if (exists) {
          errorMessages.push(
            "Overlapping warehouse budget hour already exists for this warehouse and vendor.",
          );
          continue;
        }
        const entity = this.warehouseBudgetHoursRepository.create({
          warehouse_id,
          budget_hours: budget_hours,
          budget_date_from: createDto.budget_date_from,
          budget_date_to: createDto.budget_date_to,
          vendor_id: resolvedVendorId,
          status_id: status_id ?? 1,
          created_by: userId,
          updated_by: userId,
        });
        const saved = await this.warehouseBudgetHoursRepository.save(entity);
        await this.auditTrailService.create(
          {
            service: "WarehouseBudgetHoursService",
            method: "create",
            raw_data: JSON.stringify({
              ...createDto,
              warehouse_id,
              vendor_id: resolvedVendorId,
            }),
            description: `Created warehouse budget hour for warehouse_id ${warehouse_id} and vendor_id ${resolvedVendorId}`,
            status_id: 1,
          },
          userId,
        );
        results.push(saved);
      }
    }
    if (errorMessages.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: errorMessages.join(" | "),
      });
    }
    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal("warehouse_budget_hours", 0);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }
    return results;
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseBudgetHourDto,
    userId: number,
  ): Promise<any> {
    const { warehouse_ids, vendor_ids, budget_hours, status_id } = updateDto;

    // If warehouse_ids is provided, match on warehouse_id (+ vendor_id when given), else update the single record by id
    // Bulk update scenario kapag may ibinigay na warehouse_ids
    if (warehouse_ids && warehouse_ids.length > 0) {
      const savedResults = [];
      const errorMessages: string[] = [];

      // Resolve vendor IDs kung ibinigay; kung wala, gamitin ang existing vendor ng record
      const resolvedVendorIds: number[] | undefined =
        vendor_ids && vendor_ids.length > 0
          ? await Promise.all(
              vendor_ids.map((vendor_id) => this.resolveVendorId(vendor_id)),
            )
          : undefined;

      const vendorTargets = resolvedVendorIds ?? [undefined];

      // 1. Loop sa lahat ng warehouse_id at vendor_id combinations
      for (const warehouse_id of warehouse_ids) {
        for (const resolvedVendorId of vendorTargets) {
          const findWhere: any = { warehouse_id };
          if (resolvedVendorId !== undefined) {
            findWhere.vendor_id = resolvedVendorId;
          }

          const budgetHour = await this.warehouseBudgetHoursRepository.findOne({
            where: findWhere,
          });

          if (!budgetHour) {
            errorMessages.push(
              `Store budget hour record not found for Store ID ${warehouse_id}${
                resolvedVendorId ? ` and Vendor ID ${resolvedVendorId}` : ""
              }.`,
            );
            continue; // Ituloy ang loop para mahanap pa ang ibang potential errors
          }

          const effectiveVendorId =
            resolvedVendorId !== undefined
              ? resolvedVendorId
              : budgetHour.vendor_id;

          // Suriin kung may overlapping date range para sa specific store/vendor combo
          const duplicate = await this.findOverlappingBudgetHour(
            warehouse_id,
            effectiveVendorId,
            updateDto.budget_date_from ?? budgetHour.budget_date_from,
            updateDto.budget_date_to ?? budgetHour.budget_date_to,
            budgetHour.id, // I-exclude ang sarili nitong ID sa check
          );

          if (duplicate) {
            errorMessages.push(
              `Overlapping budget hour already exists for Store ID ${warehouse_id} and Vendor ID ${effectiveVendorId}.`,
            );
            continue;
          }

          // i-prepare ang updated values
          Object.assign(budgetHour, {
            budget_hours,
            budget_date_from:
              updateDto.budget_date_from ?? budgetHour.budget_date_from,
            budget_date_to:
              updateDto.budget_date_to ?? budgetHour.budget_date_to,
            vendor_id: effectiveVendorId,
            status_id: status_id ?? budgetHour.status_id,
            updated_by: userId,
          });

          const saved =
            await this.warehouseBudgetHoursRepository.save(budgetHour);

          await this.auditTrailService.create(
            {
              service: "WarehouseBudgetHoursService",
              method: "update",
              raw_data: JSON.stringify({
                ...updateDto,
                warehouse_id,
                vendor_id: effectiveVendorId,
              }),
              description: `Updated warehouse budget hour for warehouse_id ${warehouse_id} and vendor_id ${effectiveVendorId}`,
              status_id: 1,
            },
            userId,
          );

          savedResults.push(saved);
        }
      }

      // 2. Kapag may nakitang maski isang error sa buong loop, mag-throw ng BadRequestException
      if (errorMessages.length > 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: errorMessages.join(" | "),
          errors:
            "Failed to update store budget hours due to validation errors.", // Ipapasa ang array ng errors sa front-end
        });
      }

      // 3. Mag-emit ng SSE event kung matagumpay ang lahat
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_budget_hours", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return savedResults;
    } else {
      // Single record update scenario (fallback by ID)
      const budgetHour = await this.warehouseBudgetHoursRepository.findOne({
        where: { id },
      });

      if (!budgetHour) {
        throw new NotFoundException(
          `Store budget hour with ID ${id} not found.`,
        );
      }

      const resolvedVendorId =
        vendor_ids && vendor_ids.length > 0
          ? await this.resolveVendorId(vendor_ids[0])
          : budgetHour.vendor_id;

      const targetWarehouseId =
        updateDto.warehouse_ids?.[0] ?? budgetHour.warehouse_id;

      const overlapping = await this.findOverlappingBudgetHour(
        targetWarehouseId,
        resolvedVendorId,
        updateDto.budget_date_from ?? budgetHour.budget_date_from,
        updateDto.budget_date_to ?? budgetHour.budget_date_to,
        budgetHour.id,
      );

      if (overlapping) {
        throw new BadRequestException(
          `Overlapping budget hour already exists for Store ID ${targetWarehouseId}.`,
        );
      }

      Object.assign(budgetHour, updateDto, {
        vendor_id: resolvedVendorId,
        updated_by: userId,
      });

      const saved = await this.warehouseBudgetHoursRepository.save(budgetHour);

      await this.auditTrailService.create(
        {
          service: "WarehouseBudgetHoursService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated warehouse budget hour id ${id}`,
          status_id: 1,
        },
        userId,
      );

      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_budget_hours", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return saved;
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const budgetHour = await this.warehouseBudgetHoursRepository.findOne({
      where: { id },
    });
    if (!budgetHour) throw new NotFoundException("Store budget hour not found");
    budgetHour.status_id = budgetHour.status_id === 1 ? 2 : 1;
    budgetHour.updated_by = userId;
    const newStatusName = budgetHour.status_id === 1 ? "ACTIVE" : "INACTIVE";
    const saved = await this.warehouseBudgetHoursRepository.save(budgetHour);
    await this.auditTrailService.create(
      {
        service: "WarehouseBudgetHoursService",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id, new_status: budgetHour.status_id }),
        description: `Toggled status for warehouse budget hour id ${id} to ${newStatusName}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_budget_hours", id);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }
    return saved;
  }

  async bulkUploadFromExcel(
    records: any[],
    userId: number,
    allowedLocationIds?: number[],
  ) {
    const warehouses = await this.warehousesService.findAll();
    const vendors = await this.vendorsRepository.find();
    const vendorByCode = new Map(
      vendors.map((v) => [v.service_provider_code?.toUpperCase(), v]),
    );
    let inserted_count = 0;
    let updated_count = 0;
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: any[] = [];
    const success: any[] = [];

    for (const row of records) {
      const warehouse = warehouses.find(
        (w) => w.warehouse_ifs == row.warehouse_ifs,
      );
      if (!warehouse) {
        errors.push({
          row: row.__rowNum__,
          error: `Store not found: STORE IFS ${row.warehouse_ifs}`,
        });
        continue;
      }
      const vendor = vendorByCode.get(
        String(row.service_provider_code ?? "").toUpperCase(),
      );
      if (!vendor) {
        errors.push({
          row: row.__rowNum__,
          error: `Vendor not found: SERVICE PROVIDER CODE ${row.service_provider_code}`,
        });
        continue;
      }
      // Location permission check
      if (
        allowedLocationIds &&
        !allowedLocationIds.includes(warehouse.location_id)
      ) {
        errors.push({
          row: row.__rowNum__,
          error: `You do not have permission to upload rates for STORE IFS ${row.warehouse_ifs} (${row.store_name}), based on your allowed location.`,
        });
        continue;
      }
      // Validate status
      let status_id = 1;
      if (row.status === "INACTIVE") status_id = 2;
      else if (row.status === "ACTIVE") status_id = 1;
      else {
        errors.push({
          row: row.__rowNum__,
          error: `Invalid STATUS: '${row.status}'. Allowed values: ACTIVE, INACTIVE.`,
        });
        continue;
      }
      // Validate budget hours
      if (row.budget_hours === null || isNaN(row.budget_hours)) {
        errors.push({
          row: row.__rowNum__,
          error: `Missing or invalid BUDGET HOURS value for STORE IFS ${row.warehouse_ifs} (${row.store_name}).`,
        });
        continue;
      }
      try {
        const formattedDateFrom = parseExcelDateToYMD(row.budget_date_from);
        const formattedDateTo = parseExcelDateToYMD(row.budget_date_to);
        // Check for overlapping budget (warehouse_id + vendor_id + date range)
        const exists = await this.findOverlappingBudgetHour(
          warehouse.id,
          vendor.id,
          formattedDateFrom,
          formattedDateTo,
        );
        if (!exists) {
          // Insert
          const entity = this.warehouseBudgetHoursRepository.create({
            warehouse_id: warehouse.id,
            budget_hours: row.budget_hours,
            budget_date_from: formattedDateFrom,
            budget_date_to: formattedDateTo,
            vendor_id: vendor.id,
            status_id,
            created_by: userId,
            updated_by: userId,
          });
          await this.warehouseBudgetHoursRepository.save(entity);
          inserted_count++;
          inserted_row_numbers.push(row.__rowNum__);
          success.push({
            store_ifs: row.warehouse_ifs,
            store_name: row.store_name,
            service_provider_code: row.service_provider_code,
            service_provider_name: row.service_provider_name,
            vendor_id: vendor.id,
            budget_hours: row.budget_hours,
            budget_date_from: formattedDateFrom,
            budget_date_to: formattedDateTo,
            status: row.status,
            __rowNum__: row.__rowNum__,
          });
        } else {
          // Update
          exists.budget_hours = row.budget_hours;
          exists.budget_date_from = formattedDateFrom;
          exists.budget_date_to = formattedDateTo;
          exists.vendor_id = vendor.id;
          exists.status_id = status_id;
          exists.updated_by = userId;
          await this.warehouseBudgetHoursRepository.save(exists);
          updated_count++;
          updated_row_numbers.push(row.__rowNum__);
          success.push({
            store_ifs: row.warehouse_ifs,
            store_name: row.store_name,
            service_provider_code: row.service_provider_code,
            service_provider_name: row.service_provider_name,
            vendor_id: vendor.id,
            budget_hours: row.budget_hours,
            budget_date_from: formattedDateFrom,
            budget_date_to: formattedDateTo,
            status: row.status,
            __rowNum__: row.__rowNum__,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ row: row.__rowNum__, error: errorMessage });
      }
    }
    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_budget_hours", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
}
