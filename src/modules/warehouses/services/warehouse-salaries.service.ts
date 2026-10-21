import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import { CreateWarehouseSalaryDto } from "../dto/CreateWarehouseSalaryDto";
import { UpdateWarehouseSalaryDto } from "../dto/UpdateWarehouseSalaryDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { WarehousesService } from "./warehouses.service";
import { UsersService } from "../../users/services/users.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { CommonUtilitiesService } from "src/services/common-utilities.service";
import logger from "src/config/logger";
import { WarehouseSalary } from "src/entities/WarehouseSalary";
import { Vendor } from "src/entities/Vendor";
import { Position } from "src/entities/Position";
import {
  ACTION_IDS,
  STATUS_IDS,
  STATUS_NAMES,
  TOGGLE_NAMES,
} from "src/constants/customConstants";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
import { parseExcelDateToYMD } from "src/utils/date.utils";
dayjs.extend(utc);

@Injectable()
export class WarehouseSalariesService {
  constructor(
    @InjectRepository(WarehouseSalary)
    private warehouseSalariesRepository: Repository<WarehouseSalary>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(Position)
    private positionsRepository: Repository<Position>,
    @Inject(UserAuditTrailCreateService)
    private auditTrailService: UserAuditTrailCreateService,
    private warehousesService: WarehousesService,
    private usersService: UsersService,
    @Inject(ActionLogsService)
    private actionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  private readonly module_name = "STORE SALARIES";

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

  private async resolvePositionId(position_id?: number): Promise<number> {
    if (position_id === undefined || position_id === null) {
      throw new NotFoundException("position_id is required.");
    }
    const position = await this.positionsRepository.findOne({
      where: { id: position_id },
    });
    if (!position) throw new NotFoundException("Position not found");
    return position.id;
  }

  /**
   * Action logs history for a specific warehouse salary ref_id
   */
  async findOneHistory(ref_id: number) {
    return this.actionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

  /**
   * Status transition for a single warehouse salary
   * Transitions: PENDING (3), FOR_APPROVAL (6), APPROVED (7), ACTIVE (1), INACTIVE (2)
   */
  async toggleStatus(
    id: number,
    userId: number,
    status_id: number,
    undo_reason?: string,
  ): Promise<any> {
    const salary = await this.warehouseSalariesRepository.findOne({
      where: { id },
    });
    if (!salary) {
      throw new NotFoundException(`Warehouse salary with ID ${id} not found`);
    }

    const newStatusId = status_id;
    const newStatusName =
      TOGGLE_NAMES[status_id] ?? STATUS_NAMES[status_id] ?? "Pending";

    await this.warehouseSalariesRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "WarehouseSalariesService",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id, status_id: newStatusId, undo_reason }),
        description: `Toggled status for warehouse salary id: ${id} to ${newStatusName}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    // Dynamic action ID from status
    const action_id =
      await this.actionLogsService.get_action_id_from_status(newStatusId);

    // Action log
    await this.actionLogsService.logAction({
      action_id: action_id || ACTION_IDS.EDIT,
      ref_id: id,
      module_name: this.module_name,
      description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""}.`,
      raw_data: JSON.stringify({ id, status_id: newStatusId }),
      created_by: userId,
    });

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_salaries", id);
    } catch (err) {
      logger.error("[SSE] SSE event failed for update:", err);
    }

    return this.findOne(id);
  }

  /**
   * Bulk status transition for multiple warehouse salaries
   */
  async toggleBulkStatus(
    ids: number[],
    status_id: number,
    userId: number,
    undo_reason?: string,
  ): Promise<any[]> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("No warehouse salary IDs provided");
    }

    await this.warehouseSalariesRepository
      .createQueryBuilder()
      .update()
      .set({
        status_id,
        updated_by: userId,
      })
      .whereInIds(ids)
      .execute();

    const newStatusName =
      TOGGLE_NAMES[status_id] ?? STATUS_NAMES[status_id] ?? "Pending";

    const action_id =
      await this.actionLogsService.get_action_id_from_status(status_id);

    for (const id of ids) {
      await this.actionLogsService.logAction({
        action_id: action_id || ACTION_IDS.EDIT,
        ref_id: id,
        module_name: this.module_name,
        description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""}.`,
        raw_data: JSON.stringify({ id, status_id }),
        created_by: userId,
      });
    }

    await this.auditTrailService.create(
      {
        service: "WarehouseSalariesService",
        method: "toggleBulkStatus",
        raw_data: JSON.stringify({ ids, status_id, undo_reason }),
        description: `Bulk toggled status for warehouse salary ids: [${ids.join(", ")}] to status_id: ${status_id}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_salaries", 0);
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }

    return Promise.all(ids.map((id) => this.findOne(id)));
  }

  /**
   * Re-aligns the entire chronological timeline for a unique combination.
   * Ensures:
   * - Records are ordered by date_from ASC
   * - Each record's date_to is strictly 1 day before the next record's date_from
   * - The latest record has date_to = null (open-ended / ongoing)
   * - Completely eliminates traps, overlaps, and date gaps.
   */
  async realignTimeline(
    warehouse_id: number,
    vendor_id: number,
    position_id: number,
    userId: number,
  ): Promise<WarehouseSalary[]> {
    const records = await this.warehouseSalariesRepository.find({
      where: { warehouse_id, vendor_id, position_id },
      order: { date_from: "ASC" },
    });

    if (records.length === 0) return [];

    const toSave: WarehouseSalary[] = [];

    for (let i = 0; i < records.length; i++) {
      const current = records[i];
      let expectedDateTo: string | null = null;

      if (i < records.length - 1) {
        // Ends 1 day before the next period starts
        const next = records[i + 1];
        expectedDateTo = dayjs(next.date_from)
          .subtract(1, "day")
          .format("YYYY-MM-DD");
      } else {
        // Latest record is open-ended
        expectedDateTo = null;
      }

      if (current.date_to !== expectedDateTo) {
        current.date_to = expectedDateTo;
        current.updated_by = userId;
        toSave.push(current);
      }
    }

    if (toSave.length > 0) {
      await this.warehouseSalariesRepository.save(toSave);
    }

    return records;
  }

  /**
   * Smart Upsert / Effective Dating Logic for Warehouse Salaries
   * Truly zero-friction:
   * - If date_from matches an existing entry, updates in-place.
   * - If date_from is new (future, past backfill, or in between), inserts and automatically realigns all neighbors.
   * - Never throws overlap traps.
   */
  async processEffectiveSalary(
    warehouse_id: number,
    vendor_id: number,
    position_id: number,
    date_from: string,
    salary: number,
    userId: number,
    status_id: number = STATUS_IDS.PENDING,
  ): Promise<{ action: "inserted" | "updated"; record: WarehouseSalary }> {
    // 1. Check if an exact date_from already exists for this combination
    const exactMatch = await this.warehouseSalariesRepository.findOne({
      where: { warehouse_id, vendor_id, position_id, date_from },
    });

    if (exactMatch) {
      exactMatch.salary = salary;
      exactMatch.status_id = status_id ?? exactMatch.status_id;
      exactMatch.updated_by = userId;
      const saved = await this.warehouseSalariesRepository.save(exactMatch);

      await this.realignTimeline(warehouse_id, vendor_id, position_id, userId);

      await this.actionLogsService.logAction({
        action_id: ACTION_IDS.EDIT,
        ref_id: saved.id,
        module_name: this.module_name,
        description: `Updated warehouse salary with salary ${saved.salary}`,
        raw_data: JSON.stringify(saved),
        created_by: userId,
      });

      return { action: "updated", record: saved };
    }

    // 2. Insert new record
    const entity = this.warehouseSalariesRepository.create({
      warehouse_id,
      vendor_id,
      position_id,
      date_from,
      date_to: null,
      salary,
      status_id: status_id ?? STATUS_IDS.PENDING,
      created_by: userId,
      updated_by: userId,
    });
    const saved = await this.warehouseSalariesRepository.save(entity);

    // 3. Re-align entire timeline seamlessly
    await this.realignTimeline(warehouse_id, vendor_id, position_id, userId);

    await this.actionLogsService.logAction({
      action_id: ACTION_IDS.ADD,
      ref_id: saved.id,
      module_name: this.module_name,
      description: `Created warehouse salary with salary ${saved.salary} and status ${STATUS_NAMES[saved.status_id] || "Pending"}`,
      raw_data: JSON.stringify(saved),
      created_by: userId,
    });

    const refreshed = await this.warehouseSalariesRepository.findOne({
      where: { id: saved.id },
    });

    return { action: "inserted", record: refreshed || saved };
  }

  /**
   * Generic reusable lookup for approved warehouse salaries per warehouse/vendor/position/date.
   * Returns a map keyed by `${vendor_id}-${warehouse_id}-${position_id}-${YYYY-MM-DD}` -> WarehouseSalary.
   */
  async getSalariesMap(
    requests: Array<{
      vendor_id: number;
      warehouse_id: number;
      position_id?: number;
      date: string;
    }>,
  ): Promise<Map<string, WarehouseSalary>> {
    const keys = new Set<string>();
    for (const r of requests) {
      if (r.vendor_id != null && r.warehouse_id != null && r.date) {
        const posKey = r.position_id != null ? r.position_id : "any";
        keys.add(`${r.vendor_id}-${r.warehouse_id}-${posKey}-${r.date}`);
      }
    }
    if (keys.size === 0) return new Map();
    const vendorIds = [
      ...new Set([...keys].map((k) => Number(k.split("-")[0]))),
    ];
    const warehouseIds = [
      ...new Set([...keys].map((k) => Number(k.split("-")[1]))),
    ];
    const filtered = await this.warehouseSalariesRepository
      .createQueryBuilder("ws")
      .where("ws.vendor_id IN (:...vendorIds)", { vendorIds })
      .andWhere("ws.warehouse_id IN (:...warehouseIds)", { warehouseIds })
      .andWhere("ws.status_id IN (:...statusIds)", {
        statusIds: [STATUS_IDS.APPROVED],
      })
      .getMany();

    const map = new Map<string, WarehouseSalary>();
    for (const row of filtered) {
      const dateFrom = row.date_from
        ? typeof row.date_from === "string" && row.date_from.length >= 10
          ? (row.date_from as string).slice(0, 10)
          : dayjs(row.date_from).format("YYYY-MM-DD")
        : "";
      const dateTo = row.date_to
        ? typeof row.date_to === "string" && row.date_to.length >= 10
          ? (row.date_to as string).slice(0, 10)
          : dayjs(row.date_to).format("YYYY-MM-DD")
        : "";
      for (const k of [...keys]) {
        const [dvId, dwId, dPosId, ...dRest] = k.split("-");
        const dIso = dRest.join("-");
        const posMatches =
          dPosId === "any" || String(row.position_id) === String(dPosId);
        if (
          String(row.vendor_id) === String(dvId) &&
          String(row.warehouse_id) === String(dwId) &&
          posMatches &&
          dIso >= dateFrom &&
          (!dateTo || dIso <= dateTo)
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
    statusId?: number[],
    hideHistorical?: boolean,
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
    const query = this.warehouseSalariesRepository
      .createQueryBuilder("ws")
      .innerJoinAndSelect("ws.warehouse", "warehouse")
      .innerJoinAndSelect("warehouse.location", "location")
      .innerJoinAndSelect("ws.status", "status")
      .innerJoinAndSelect("ws.createdBy", "createdBy")
      .leftJoinAndSelect("ws.updatedBy", "updatedBy")
      .leftJoinAndSelect("ws.vendor", "vendor")
      .leftJoinAndSelect("ws.position", "position");
    if (accessKeyId !== undefined) {
      query.andWhere("warehouse.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }

    if (statusId && statusId.length > 0) {
      query.andWhere("ws.status_id IN (:...statusId)", { statusId });
    }
    if (hideHistorical) {
      query.andWhere("ws.date_to IS NULL");
    }
    query.orderBy("ws.date_from", "DESC").addOrderBy("ws.id", "DESC");

    const salaries = await query.getMany();
    return salaries.map((salary) => ({
      id: salary.id,
      warehouse_id: salary.warehouse_id,
      warehouse_ifs: salary.warehouse?.warehouse_ifs,
      warehouse_name: salary.warehouse?.warehouse_name,
      location_id: salary.warehouse ? salary.warehouse.location_id : null,
      location_name:
        salary.warehouse && salary.warehouse.location
          ? salary.warehouse.location.location_name
          : null,
      salary: salary.salary,
      date_from: salary.date_to
        ? `${salary.date_from} - ${salary.date_to}`
        : salary.date_from,
      date_to: salary.date_to,
      vendor_id: salary.vendor_id,
      vendor_name: salary.vendor?.service_provider_name,
      vendor_code: salary.vendor?.service_provider_code,
      position_id: salary.position_id,
      position_name: salary.position?.position_name,
      position_abbr: salary.position?.position_abbr,
      status_id: salary.status_id,
      status_name: salary.status
        ? salary.status.status_name
        : (STATUS_NAMES[salary.status_id] ?? null),
      created_at: salary.created_at,
      created_by: salary.created_by,
      updated_by: salary.updated_by,
      modified_at: salary.updated_at,
      created_user: salary.createdBy
        ? `${salary.createdBy.first_name} ${salary.createdBy.last_name}`
        : null,
      updated_user: salary.updatedBy
        ? `${salary.updatedBy.first_name} ${salary.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const salary = await this.warehouseSalariesRepository.findOne({
      where: { id },
      relations: [
        "warehouse",
        "status",
        "createdBy",
        "updatedBy",
        "vendor",
        "position",
      ],
    });
    if (!salary) throw new NotFoundException("Warehouse salary not found");
    return {
      id: salary.id,
      warehouse_id: salary.warehouse_id,
      warehouse_name: salary.warehouse?.warehouse_name,
      salary: salary.salary,
      date_from: salary.date_from,
      date_to: salary.date_to,
      vendor_id: salary.vendor_id,
      vendor_name: salary.vendor?.service_provider_name,
      vendor_code: salary.vendor?.service_provider_code,
      position_id: salary.position_id,
      position_name: salary.position?.position_name,
      position_abbr: salary.position?.position_abbr,
      status_id: salary.status_id,
      status_name: salary.status
        ? salary.status.status_name
        : (STATUS_NAMES[salary.status_id] ?? null),
      created_at: salary.created_at,
      created_by: salary.created_by,
      updated_by: salary.updated_by,
      modified_at: salary.updated_at,
      created_user: salary.createdBy
        ? `${salary.createdBy.first_name} ${salary.createdBy.last_name}`
        : null,
      updated_user: salary.updatedBy
        ? `${salary.updatedBy.first_name} ${salary.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createDto: CreateWarehouseSalaryDto,
    userId: number,
  ): Promise<any> {
    const {
      warehouse_ids,
      vendor_ids,
      position_ids,
      date_from,
      salary,
      status_id,
    } = createDto;
    const results = [];
    const errorMessages: string[] = [];

    const resolvedVendorIds: number[] = [];
    for (const vendor_id of vendor_ids) {
      resolvedVendorIds.push(await this.resolveVendorId(vendor_id));
    }

    const resolvedPositionIds: number[] = [];
    for (const position_id of position_ids) {
      resolvedPositionIds.push(await this.resolvePositionId(position_id));
    }

    const targetStatusId = status_id ?? STATUS_IDS.PENDING;

    for (const warehouse_id of warehouse_ids) {
      for (const resolvedVendorId of resolvedVendorIds) {
        for (const resolvedPositionId of resolvedPositionIds) {
          try {
            const outcome = await this.processEffectiveSalary(
              warehouse_id,
              resolvedVendorId,
              resolvedPositionId,
              date_from,
              salary,
              userId,
              targetStatusId,
            );

            await this.auditTrailService.create(
              {
                service: "WarehouseSalariesService",
                method: "create",
                raw_data: JSON.stringify({
                  ...createDto,
                  warehouse_id,
                  vendor_id: resolvedVendorId,
                  position_id: resolvedPositionId,
                  outcome: outcome.action,
                }),
                description: `${outcome.action === "inserted" ? "Created" : "Updated"} warehouse salary for store ${warehouse_id}, vendor ${resolvedVendorId}, position ${resolvedPositionId}`,
                status_id: STATUS_IDS.ACTIVE,
              },
              userId,
            );

            results.push(outcome.record);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errorMessages.push(
              `Store ${warehouse_id}, Vendor ${resolvedVendorId}, Position ${resolvedPositionId}: ${msg}`,
            );
          }
        }
      }
    }

    if (errorMessages.length > 0 && results.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: errorMessages.join(" | "),
      });
    }

    try {
      this.sseEventEmitter.emitCreateSignal("warehouse_salaries", 0);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }
    return results;
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseSalaryDto,
    userId: number,
  ): Promise<any> {
    const {
      warehouse_ids,
      vendor_ids,
      position_ids,
      salary,
      date_from,
      status_id,
    } = updateDto;

    // Multi-store batch update scenario (when more than 1 warehouse_id is given)
    if (warehouse_ids && warehouse_ids.length > 1) {
      const savedResults = [];
      const errorMessages: string[] = [];

      const resolvedVendorIds =
        vendor_ids && vendor_ids.length > 0
          ? await Promise.all(
              vendor_ids.map((v_id) => this.resolveVendorId(v_id)),
            )
          : [undefined];

      const resolvedPositionIds =
        position_ids && position_ids.length > 0
          ? await Promise.all(
              position_ids.map((p_id) => this.resolvePositionId(p_id)),
            )
          : [undefined];

      for (const warehouse_id of warehouse_ids) {
        for (const resolvedVendorId of resolvedVendorIds) {
          for (const resolvedPositionId of resolvedPositionIds) {
            const findWhere: any = { warehouse_id };
            if (resolvedVendorId !== undefined) {
              findWhere.vendor_id = resolvedVendorId;
            }
            if (resolvedPositionId !== undefined) {
              findWhere.position_id = resolvedPositionId;
            }

            const existingRecord =
              await this.warehouseSalariesRepository.findOne({
                where: findWhere,
              });

            if (!existingRecord) {
              errorMessages.push(
                `Store salary record not found for Store ID ${warehouse_id}`,
              );
              continue;
            }

            const effectiveVendorId =
              resolvedVendorId ?? existingRecord.vendor_id;
            const effectivePositionId =
              resolvedPositionId ?? existingRecord.position_id;
            const targetDateFrom = date_from ?? existingRecord.date_from;
            const targetSalary =
              salary !== undefined ? salary : existingRecord.salary;

            try {
              const outcome = await this.processEffectiveSalary(
                warehouse_id,
                effectiveVendorId,
                effectivePositionId,
                targetDateFrom,
                targetSalary,
                userId,
                status_id ?? existingRecord.status_id,
              );
              savedResults.push(outcome.record);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errorMessages.push(`Store ${warehouse_id}: ${msg}`);
            }
          }
        }
      }

      if (errorMessages.length > 0 && savedResults.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: errorMessages.join(" | "),
        });
      }

      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_salaries", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return savedResults;
    } else {
      // Single record update scenario (by ID) - e.g. from modal/form
      const existingRecord = await this.warehouseSalariesRepository.findOne({
        where: { id },
      });

      if (!existingRecord) {
        throw new NotFoundException(`Store salary with ID ${id} not found.`);
      }

      const resolvedVendorId =
        vendor_ids && vendor_ids.length > 0
          ? await this.resolveVendorId(vendor_ids[0])
          : existingRecord.vendor_id;

      const resolvedPositionId =
        position_ids && position_ids.length > 0
          ? await this.resolvePositionId(position_ids[0])
          : existingRecord.position_id;

      const targetWarehouseId =
        warehouse_ids && warehouse_ids.length > 0
          ? warehouse_ids[0]
          : existingRecord.warehouse_id;

      const newDateFrom = date_from ?? existingRecord.date_from;

      // Check if another record (different ID) already starts on this exact newDateFrom
      const duplicateDateRecord =
        await this.warehouseSalariesRepository.findOne({
          where: {
            warehouse_id: targetWarehouseId,
            vendor_id: resolvedVendorId,
            position_id: resolvedPositionId,
            id: Not(id),
            date_from: newDateFrom,
          },
        });

      if (duplicateDateRecord) {
        // Merge into the duplicate record with updated salary & remove redundant entry
        duplicateDateRecord.salary =
          salary !== undefined ? salary : existingRecord.salary;
        duplicateDateRecord.status_id = status_id ?? existingRecord.status_id;
        duplicateDateRecord.updated_by = userId;
        await this.warehouseSalariesRepository.save(duplicateDateRecord);
        await this.warehouseSalariesRepository.remove(existingRecord);

        // Re-align timeline
        await this.realignTimeline(
          targetWarehouseId,
          resolvedVendorId,
          resolvedPositionId,
          userId,
        );

        return this.findOne(duplicateDateRecord.id);
      }

      // Update existing record
      existingRecord.warehouse_id = targetWarehouseId;
      existingRecord.vendor_id = resolvedVendorId;
      existingRecord.position_id = resolvedPositionId;
      existingRecord.date_from = newDateFrom;
      if (salary !== undefined) {
        existingRecord.salary = salary;
      }
      if (status_id !== undefined) {
        existingRecord.status_id = status_id;
      }
      existingRecord.updated_by = userId;

      await this.warehouseSalariesRepository.save(existingRecord);

      // Automatically re-align neighboring records (no gaps, no overlaps, no traps!)
      await this.realignTimeline(
        targetWarehouseId,
        resolvedVendorId,
        resolvedPositionId,
        userId,
      );

      await this.auditTrailService.create(
        {
          service: "WarehouseSalariesService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated warehouse salary id ${id}`,
          status_id: STATUS_IDS.ACTIVE,
        },
        userId,
      );

      await this.actionLogsService.logAction({
        action_id: ACTION_IDS.EDIT,
        ref_id: id,
        module_name: this.module_name,
        description: `Updated warehouse salary with salary ${existingRecord.salary} and date_from ${existingRecord.date_from}`,
        raw_data: JSON.stringify(updateDto),
        created_by: userId,
      });

      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_salaries", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return this.findOne(id);
    }
  }

  /**
   * Bulk Upload from Excel with Row-Level Isolation (Zero-friction for 1,000 stores)
   * Default status is PENDING (3) unless specified in the sheet.
   */
  async bulkUploadFromExcel(
    records: any[],
    userId: number,
    allowedLocationIds?: number[],
  ) {
    const warehouses = await this.warehousesService.findAll();
    const vendors = await this.vendorsRepository.find();
    const positions = await this.positionsRepository.find();

    const vendorByCode = new Map(
      vendors.map((v) => [v.service_provider_code?.toUpperCase(), v]),
    );
    const positionByName = new Map(
      positions.map((p) => [p.position_name?.trim().toUpperCase(), p]),
    );
    const positionByAbbr = new Map(
      positions.map((p) => [p.position_abbr?.trim().toUpperCase(), p]),
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
      const posKey = String(row.position_name ?? "")
        .trim()
        .toUpperCase();
      const position = positionByName.get(posKey) || positionByAbbr.get(posKey);
      if (!position) {
        errors.push({
          row: row.__rowNum__,
          error: `Position not found: '${row.position_name}'`,
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
          error: `You do not have permission to upload salaries for STORE IFS ${row.warehouse_ifs} (${row.store_name}), based on your allowed location.`,
        });
        continue;
      }

      // Map status from Excel, default to PENDING (3)
      let status_id: number = STATUS_IDS.PENDING;
      if (row.status) {
        const normalized = String(row.status).trim().toUpperCase();
        if (normalized === "PENDING") status_id = STATUS_IDS.PENDING;
        else if (normalized === "FOR APPROVAL" || normalized === "FOR_APPROVAL")
          status_id = STATUS_IDS.FOR_APPROVAL;
        else if (normalized === "APPROVE" || normalized === "APPROVED")
          status_id = STATUS_IDS.APPROVED;
        else if (normalized === "ACTIVE") status_id = STATUS_IDS.ACTIVE;
        else if (normalized === "INACTIVE") status_id = STATUS_IDS.INACTIVE;
      }

      // Validate salary
      if (row.salary === null || isNaN(row.salary)) {
        errors.push({
          row: row.__rowNum__,
          error: `Missing or invalid SALARY value for STORE IFS ${row.warehouse_ifs} (${row.store_name}).`,
        });
        continue;
      }
      try {
        const formattedDateFrom = parseExcelDateToYMD(row.date_from);

        const outcome = await this.processEffectiveSalary(
          warehouse.id,
          vendor.id,
          position.id,
          formattedDateFrom,
          row.salary,
          userId,
          status_id,
        );

        if (outcome.action === "inserted") {
          inserted_count++;
          inserted_row_numbers.push(row.__rowNum__);
        } else {
          updated_count++;
          updated_row_numbers.push(row.__rowNum__);
        }

        success.push({
          store_ifs: row.warehouse_ifs,
          store_name: row.store_name,
          service_provider_code: row.service_provider_code,
          service_provider_name: row.service_provider_name,
          vendor_id: vendor.id,
          position_id: position.id,
          position_name: position.position_name,
          salary: row.salary,
          date_from: formattedDateFrom,
          date_to: outcome.record.date_to,
          status_id: outcome.record.status_id,
          status_name: STATUS_NAMES[outcome.record.status_id] ?? "Pending",
          action: outcome.action,
          __rowNum__: row.__rowNum__,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ row: row.__rowNum__, error: errorMessage });
      }
    }

    if (inserted_count > 0 || updated_count > 0) {
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_salaries", 0);
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
