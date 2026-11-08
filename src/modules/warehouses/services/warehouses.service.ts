import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Warehouse } from "../../../entities/Warehouse";
import { WarehouseType } from "../../../entities/WarehouseType";
import { PosAvailability } from "../../../entities/PosAvailability";
import { Status } from "../../../entities/Status";
import { UsersService } from "../../users/services/users.service";
import { CreateWarehouseDto } from "../dto/CreateWarehouseDto";
import { UpdateWarehouseDto } from "../dto/UpdateWarehouseDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import {
  ACTION_IDS,
  STATUS_IDS,
  STATUS_NAMES,
  TOGGLE_NAMES,
} from "src/constants/customConstants";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";
import { ActionLogsService } from "../../actions/services/action-logs.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class WarehousesService {
  private readonly moduleName = "TAKEOUTSTORES";
  private readonly defaultRelations = [
    "warehouseType",
    "location",
    "segment",
    "status",
    "remStatus",
    "posAvailability",
    "createdBy",
    "updatedBy",
  ];

  constructor(
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    @InjectRepository(WarehouseType)
    private warehouseTypesRepository: Repository<WarehouseType>,
    @InjectRepository(PosAvailability)
    private posAvailabilityRepository: Repository<PosAvailability>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private cacheInvalidationService: CacheInvalidationService,
    private actionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  private formatWarehouse(w: Warehouse): any {
    return {
      id: w.id,
      warehouse_name: w.warehouse_name,
      warehouse_ifs: w.warehouse_ifs,
      warehouse_code: w.warehouse_code,
      warehouse_type_id: w.warehouse_type_id,
      location_id: w.location_id,
      segment_id: w.segment_id,
      brand_id: w.segment_id,
      address: w.address,
      status_id: w.status_id,
      rem_status_id: w.rem_status_id,
      pos_availability_id: w.pos_availability_id,
      allowance: w.allowance ? Number(w.allowance) : 0,
      start_operation: w.start_operation,
      end_operation: w.end_operation,
      starting_time: w.starting_time,
      ending_time: w.ending_time,
      latitude:
        w.latitude !== null && w.latitude !== undefined
          ? Number(w.latitude)
          : null,
      longitude:
        w.longitude !== null && w.longitude !== undefined
          ? Number(w.longitude)
          : null,
      created_at: w.created_at,
      created_by: w.created_by,
      updated_by: w.updated_by,
      modified_at: w.modified_at,
      warehouse_type_name: w.warehouseType
        ? w.warehouseType.warehouse_type_name
        : null,
      location_name: w.location ? w.location.location_name : null,
      segment_name: w.segment ? w.segment.segment_name : null,
      status_name: w.status ? w.status.status_name : null,
      rem_status_name: w.remStatus ? w.remStatus.status_name : null,
      pos_availability_name: w.posAvailability
        ? w.posAvailability.pos_availability
        : null,
      created_user: w.createdBy
        ? `${w.createdBy.first_name} ${w.createdBy.last_name}`
        : null,
      updated_user: w.updatedBy
        ? `${w.updatedBy.first_name} ${w.updatedBy.last_name}`
        : null,
    };
  }

  async findAll(
    warehouse_type_id?: number,
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
  ): Promise<any[]> {
    const where: any = {
      status_id: STATUS_IDS.ACTIVE,
    };

    if (warehouse_type_id !== undefined) {
      where.warehouse_type_id = warehouse_type_id;
    }

    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }

    if (userId && roleId) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId,
          accessKeyId,
        );
      where.location_id = In(allowedLocationIds);
    }

    const warehouses = await this.warehousesRepository.find({
      where,
      relations: this.defaultRelations,
    });

    return warehouses.map((w) => this.formatWarehouse(w));
  }

  async findAllPerStatus(
    warehouse_type_id?: number,
    statusId?: number,
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
  ): Promise<any[]> {
    const where: any = {};
    if (warehouse_type_id) {
      where.warehouse_type_id = warehouse_type_id;
    }
    if (statusId) {
      where.status_id = statusId;
    }
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }
    if (userId && roleId) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId,
          accessKeyId,
        );
      where.location_id = In(allowedLocationIds);
    }
    const warehouses = await this.warehousesRepository.find({
      where,
      relations: this.defaultRelations,
    });
    return warehouses.map((w) => this.formatWarehouse(w));
  }

  async findOne(id: number): Promise<any> {
    const w = await this.warehousesRepository.findOne({
      where: { id },
      relations: this.defaultRelations,
    });
    if (!w) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return this.formatWarehouse(w);
  }

  async create(createDto: CreateWarehouseDto, userId: number): Promise<any> {
    const exists = await this.warehousesRepository.findOne({
      where: [
        { warehouse_name: createDto.warehouse_name },
        { warehouse_ifs: createDto.warehouse_ifs },
        { warehouse_code: createDto.warehouse_code },
      ],
    });
    if (exists) {
      throw new BadRequestException(
        "Warehouse with this name, IFS, or code already exists",
      );
    }

    const segmentId = createDto.segment_id ?? createDto.brand_id;
    if (!segmentId) {
      throw new BadRequestException("segment_id or brand_id is required");
    }

    const newWarehouse = this.warehousesRepository.create({
      ...createDto,
      segment_id: segmentId,
      status_id: createDto.status_id ?? STATUS_IDS.ACTIVE,
      rem_status_id: createDto.rem_status_id ?? STATUS_IDS.OPEN,
      latitude:
        createDto.latitude !== undefined && createDto.latitude !== null
          ? Number(createDto.latitude)
          : null,
      longitude:
        createDto.longitude !== undefined && createDto.longitude !== null
          ? Number(createDto.longitude)
          : null,
      access_key_id: createDto.access_key_id,
      created_by: userId,
      updated_by: userId,
    });

    try {
      const saved = await this.warehousesRepository.save(newWarehouse);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehousesService",
          method: "create",
          raw_data: JSON.stringify({ ...createDto }),
          description: `Created warehouse: ${saved.warehouse_name} - ${saved.warehouse_ifs}`,
          status_id: 1,
        },
        userId,
      );

      // Invalidate caches
      await this.cacheInvalidationService.invalidateWarehouses();

      // SSE notification
      try {
        this.sseEventEmitter.emitCreateSignal("warehouses", saved.id);
      } catch (err) {
        logger.error("SSE event failed for create warehouse:", err);
      }

      return this.findOne(saved.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create warehouse";
      throw new BadRequestException(message);
    }
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseDto,
    userId: number,
  ): Promise<any> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    if (
      updateDto.warehouse_name ||
      updateDto.warehouse_ifs ||
      updateDto.warehouse_code
    ) {
      const whereConditions: any[] = [];
      if (updateDto.warehouse_name) {
        whereConditions.push({ warehouse_name: updateDto.warehouse_name });
      }
      if (updateDto.warehouse_ifs) {
        whereConditions.push({ warehouse_ifs: updateDto.warehouse_ifs });
      }
      if (updateDto.warehouse_code) {
        whereConditions.push({ warehouse_code: updateDto.warehouse_code });
      }

      if (whereConditions.length > 0) {
        const exists = await this.warehousesRepository.findOne({
          where: whereConditions,
        });
        if (exists && exists.id !== id) {
          throw new BadRequestException(
            "Warehouse with this name, IFS, or code already exists",
          );
        }
      }
    }

    const { brand_id, ...rest } = updateDto as any;
    const segmentId = updateDto.segment_id ?? brand_id;

    const updatePayload: any = {
      ...rest,
      updated_by: userId,
    };
    if (segmentId !== undefined) {
      updatePayload.segment_id = segmentId;
    }
    if (updateDto.latitude !== undefined) {
      updatePayload.latitude =
        updateDto.latitude !== null ? Number(updateDto.latitude) : null;
    }
    if (updateDto.longitude !== undefined) {
      updatePayload.longitude =
        updateDto.longitude !== null ? Number(updateDto.longitude) : null;
    }

    await this.warehousesRepository.update(id, updatePayload);

    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "WarehousesService",
        method: "update",
        raw_data: JSON.stringify({ ...updateDto }),
        description: `Updated warehouse ID: ${id} - ${warehouse.warehouse_ifs}`,
        status_id: 1,
      },
      userId,
    );

    // Invalidate caches
    await this.cacheInvalidationService.invalidateWarehouses();

    // SSE notification
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouses", id);
    } catch (err) {
      logger.error("SSE event failed for update warehouse:", err);
    }

    return this.findOne(id);
  }

  async remove(id: number, userId?: number): Promise<void> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id },
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    await this.warehousesRepository.remove(warehouse);

    if (userId) {
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehousesService",
          method: "remove",
          raw_data: JSON.stringify({
            id,
            warehouse_name: warehouse.warehouse_name,
            warehouse_ifs: warehouse.warehouse_ifs,
          }),
          description: `Deleted warehouse ID: ${id} - ${warehouse.warehouse_name}`,
          status_id: 1,
        },
        userId,
      );
    }

    // Invalidate caches
    await this.cacheInvalidationService.invalidateWarehouses();

    // SSE notification
    try {
      this.sseEventEmitter.emitDeleteSignal("warehouses", id);
    } catch (err) {
      logger.error("SSE event failed for delete warehouse:", err);
    }
  }

  /**
   * Toggles status_id between ACTIVE (1) and INACTIVE (2)
   */
  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const warehouse = await this.warehousesRepository.findOne({
        where: { id },
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }

      const newStatusId =
        warehouse.status_id === STATUS_IDS.ACTIVE
          ? STATUS_IDS.INACTIVE
          : STATUS_IDS.ACTIVE;
      const newStatusName =
        newStatusId === STATUS_IDS.ACTIVE ? "Active" : "Inactive";

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.warehousesRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehousesService",
          method: "toggleStatus",
          raw_data: JSON.stringify({
            id,
            prev_status_id: warehouse.status_id,
            new_status_id: newStatusId,
          }),
          description: `Toggled status to ${newStatusName} for warehouse ID: ${id} - ${warehouse.warehouse_ifs}`,
          status_id: 1,
        },
        userId,
      );

      // Invalidate caches
      await this.cacheInvalidationService.invalidateWarehouses();

      // SSE notification
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouses", id);
      } catch (err) {
        logger.error("SSE event failed for toggle warehouse status:", err);
      }

      return this.findOne(id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      logger.error("Error toggling warehouse status:", error);
      throw new Error("Failed to toggle warehouse status");
    }
  }

  /**
   * Bulk status transition for multiple warehouses updating rem_status_id
   * Valid status IDs:
   * 8: OPEN, 9: SOON_TO_OPEN, 10: PERMANENT_CLOSED, 11: CANCELLED_DECLINED, 12: TEMPORARY_CLOSED
   */
  async toggleBulkStatus(
    ids: number[],
    status_id: number,
    userId: number,
    undo_reason?: string,
  ): Promise<any[]> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("No warehouse IDs provided");
    }

    const validStatusIds: number[] = [
      STATUS_IDS.OPEN,
      STATUS_IDS.SOON_TO_OPEN,
      STATUS_IDS.PERMANENT_CLOSED,
      STATUS_IDS.CANCELLED_DECLINED,
      STATUS_IDS.TEMPORARY_CLOSED,
    ];

    if (!validStatusIds.includes(status_id)) {
      throw new BadRequestException(
        `Invalid status_id. Allowed REM statuses are: ${validStatusIds.join(", ")}`,
      );
    }

    const statusRecord = await this.statusRepository.findOne({
      where: { id: status_id },
    });
    if (!statusRecord) {
      throw new BadRequestException(
        `Status with ID ${status_id} does not exist in Status table`,
      );
    }

    // Bulk update rem_status_id
    await this.warehousesRepository
      .createQueryBuilder()
      .update()
      .set({
        rem_status_id: status_id,
        updated_by: userId,
      })
      .whereInIds(ids)
      .execute();

    const newStatusName =
      statusRecord.status_name ??
      (STATUS_NAMES as Record<number, string>)[status_id] ??
      (TOGGLE_NAMES as Record<number, string>)[status_id] ??
      `Status ${status_id}`;

    // Action logs batch for warehouses
    try {
      const actionLogs = ids.map((id) => ({
        ref_id: id,
        action_id: ACTION_IDS.POST,
        description: `Bulk updated REM status to ${newStatusName}${undo_reason ? ` (Reason: ${undo_reason})` : ""}.`,
        raw_data: JSON.stringify({ id, rem_status_id: status_id, undo_reason }),
        created_by: userId,
      }));
      await this.actionLogsService.logActionBatch(this.moduleName, actionLogs);
    } catch (err) {
      logger.warn(
        "Failed to write action logs for bulk warehouse status toggle:",
        err,
      );
    }

    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "WarehousesService",
        method: "toggleBulkStatus",
        raw_data: JSON.stringify({
          ids,
          rem_status_id: status_id,
          undo_reason,
        }),
        description: `Bulk toggled REM status for warehouse IDs: [${ids.join(", ")}] to ${newStatusName} (status_id: ${status_id})${undo_reason ? ` - Reason: ${undo_reason}` : ""}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    // Invalidate caches
    await this.cacheInvalidationService.invalidateWarehouses();

    // SSE notification
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouses", 0);
    } catch (err) {
      logger.error("SSE event failed for bulk toggle warehouse status:", err);
    }

    return Promise.all(ids.map((id) => this.findOne(id)));
  }

  /**
   * Single warehouse REM status update
   */
  async changeRemStatus(
    id: number,
    status_id: number,
    userId: number,
    undo_reason?: string,
  ): Promise<any> {
    const results = await this.toggleBulkStatus(
      [id],
      status_id,
      userId,
      undo_reason,
    );
    return results[0];
  }

  /**
   * Bulk Upload from Excel with Row-Level Isolation (Uniform pattern matching warehouse-salaries.service)
   * Resolves text values against PosAvailability repo, WarehouseType repo, and customConstants STATUS_IDS
   */
  async bulkUploadFromExcel(
    records: any[],
    userId: number,
    allowedLocationIds?: number[],
    accessKeyId?: number,
    filename?: string,
  ): Promise<any> {
    const [existingWarehouses, warehouseTypes, posAvailabilities] =
      await Promise.all([
        this.warehousesRepository.find(),
        this.warehouseTypesRepository.find(),
        this.posAvailabilityRepository.find(),
      ]);

    const warehouseByIfs = new Map(
      existingWarehouses.map((w) => [w.warehouse_ifs?.toUpperCase(), w]),
    );
    const warehouseByCode = new Map(
      existingWarehouses.map((w) => [w.warehouse_code?.toUpperCase(), w]),
    );
    const warehouseByName = new Map(
      existingWarehouses.map((w) => [w.warehouse_name?.toUpperCase(), w]),
    );

    // Map WarehouseType by name, abbr, and id
    const typeByNameOrAbbr = new Map<string, WarehouseType>();
    for (const wt of warehouseTypes) {
      if (wt.warehouse_type_name) {
        typeByNameOrAbbr.set(wt.warehouse_type_name.trim().toUpperCase(), wt);
      }
      if (wt.warehouse_type_abbr) {
        typeByNameOrAbbr.set(wt.warehouse_type_abbr.trim().toUpperCase(), wt);
      }
      typeByNameOrAbbr.set(String(wt.id), wt);
    }

    // Map PosAvailability by text, stripped text, and id
    const posByText = new Map<string, PosAvailability>();
    for (const pa of posAvailabilities) {
      if (pa.pos_availability) {
        const clean = pa.pos_availability.trim().toUpperCase();
        posByText.set(clean, pa);
        posByText.set(clean.replace(/[\s_-]+/g, ""), pa);
      }
      posByText.set(String(pa.id), pa);
    }

    // Map REM Status strictly to the 5 valid values from CustomConstant
    const remStatusByText = new Map<string, number>([
      ["OPEN", STATUS_IDS.OPEN],
      ["SOON TO OPEN", STATUS_IDS.SOON_TO_OPEN],
      ["PERMANENT CLOSED", STATUS_IDS.PERMANENT_CLOSED],
      ["CANCELLED/DECLINED", STATUS_IDS.CANCELLED_DECLINED],
      ["TEMPO CLOSED", STATUS_IDS.TEMPORARY_CLOSED],
    ]);

    let inserted_count = 0;
    let updated_count = 0;
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: any[] = [];
    const success: any[] = [];

    for (const row of records) {
      const rowNum = row.__rowNum__ || 0;
      const ifsKey = String(row.warehouse_ifs ?? "")
        .trim()
        .toUpperCase();
      const codeKey = String(row.warehouse_code ?? "")
        .trim()
        .toUpperCase();
      const nameKey = String(row.warehouse_name ?? "")
        .trim()
        .toUpperCase();

      const existing =
        warehouseByIfs.get(ifsKey) ||
        warehouseByCode.get(codeKey) ||
        warehouseByName.get(nameKey);

      const targetLocationId = Number(row.location_id ?? existing?.location_id);

      // Location permission check
      if (
        allowedLocationIds &&
        allowedLocationIds.length > 0 &&
        targetLocationId &&
        !allowedLocationIds.includes(targetLocationId)
      ) {
        errors.push({
          row: rowNum,
          error: `You do not have permission for Location ID ${targetLocationId} (${row.warehouse_ifs || row.warehouse_name}), based on your allowed location.`,
        });
        continue;
      }

      // Validate and resolve Warehouse Type from text
      let resolvedWarehouseTypeId = 1;
      if (
        row.warehouse_type !== null &&
        row.warehouse_type !== undefined &&
        String(row.warehouse_type).trim() !== ""
      ) {
        const key = String(row.warehouse_type).trim().toUpperCase();
        const matched = typeByNameOrAbbr.get(key);
        if (!matched) {
          const allowedTypes = Array.from(
            new Set(
              warehouseTypes.map(
                (t) => t.warehouse_type_name || t.warehouse_type_abbr,
              ),
            ),
          ).filter(Boolean);
          errors.push({
            row: rowNum,
            error: `Invalid WAREHOUSE TYPE: '${row.warehouse_type}'. Allowed values: ${allowedTypes.join(", ")}`,
          });
          continue;
        }
        resolvedWarehouseTypeId = matched.id;
      } else if (existing) {
        resolvedWarehouseTypeId = existing.warehouse_type_id;
      }

      // Validate and resolve POS Availability from text
      let resolvedPosAvailabilityId: number | null = null;
      if (
        row.pos_availability !== null &&
        row.pos_availability !== undefined &&
        String(row.pos_availability).trim() !== ""
      ) {
        const key = String(row.pos_availability).trim().toUpperCase();
        const strippedKey = key.replace(/[\s_-]+/g, "");
        const matched = posByText.get(key) || posByText.get(strippedKey);
        if (!matched) {
          const allowedPos = Array.from(
            new Set(posAvailabilities.map((p) => p.pos_availability)),
          ).filter(Boolean);
          errors.push({
            row: rowNum,
            error: `Invalid POS AVAILABILITY: '${row.pos_availability}'. Allowed values: ${allowedPos.join(", ")}`,
          });
          continue;
        }
        resolvedPosAvailabilityId = matched.id;
      } else if (existing) {
        resolvedPosAvailabilityId = existing.pos_availability_id;
      }

      // Validate and resolve REM Status strictly (OPEN, SOON TO OPEN, PERMANENT CLOSED, CANCELLED/DECLINED, TEMPO CLOSED)
      let resolvedRemStatusId: number = STATUS_IDS.OPEN;
      if (
        row.rem_status !== null &&
        row.rem_status !== undefined &&
        String(row.rem_status).trim() !== ""
      ) {
        const key = String(row.rem_status).trim().toUpperCase();
        const matched = remStatusByText.get(key);
        if (!matched) {
          errors.push({
            row: rowNum,
            error: `Invalid REM STATUS: '${row.rem_status}'. Allowed values: OPEN, SOON TO OPEN, PERMANENT CLOSED, CANCELLED/DECLINED, TEMPO CLOSED`,
          });
          continue;
        }
        resolvedRemStatusId = matched;
      } else if (existing) {
        resolvedRemStatusId = existing.rem_status_id ?? STATUS_IDS.OPEN;
      }

      // Validate and resolve status_id: default to 1 (STATUS_IDS.ACTIVE)
      let resolvedStatusId: number = 1;
      if (
        row.status !== null &&
        row.status !== undefined &&
        String(row.status).trim() !== ""
      ) {
        const key = String(row.status).trim().toUpperCase();
        if (key === "INACTIVE" || key === "2") {
          resolvedStatusId = STATUS_IDS.INACTIVE;
        } else if (key === "ACTIVE" || key === "1") {
          resolvedStatusId = STATUS_IDS.ACTIVE;
        } else {
          resolvedStatusId = 1;
        }
      } else if (existing) {
        resolvedStatusId = existing.status_id ?? 1;
      } else {
        resolvedStatusId = 1;
      }

      const latVal =
        row.latitude !== null &&
        row.latitude !== undefined &&
        row.latitude !== ""
          ? Number(row.latitude)
          : null;
      const longVal =
        row.longitude !== null &&
        row.longitude !== undefined &&
        row.longitude !== ""
          ? Number(row.longitude)
          : null;

      try {
        let action: "inserted" | "updated";
        let saved: Warehouse;

        if (existing) {
          if (row.warehouse_name) existing.warehouse_name = row.warehouse_name;
          if (row.warehouse_ifs) existing.warehouse_ifs = row.warehouse_ifs;
          if (row.warehouse_code) existing.warehouse_code = row.warehouse_code;
          if (row.location_id) existing.location_id = Number(row.location_id);
          if (row.segment_id) existing.segment_id = Number(row.segment_id);
          existing.warehouse_type_id = resolvedWarehouseTypeId;
          if (row.address !== undefined && row.address !== null) {
            existing.address = String(row.address);
          }
          if (latVal !== null && !isNaN(latVal)) {
            existing.latitude = latVal;
          }
          if (longVal !== null && !isNaN(longVal)) {
            existing.longitude = longVal;
          }
          existing.status_id = resolvedStatusId;
          existing.rem_status_id = resolvedRemStatusId;
          existing.pos_availability_id = resolvedPosAvailabilityId;
          if (
            row.allowance !== undefined &&
            row.allowance !== null &&
            !isNaN(Number(row.allowance))
          ) {
            existing.allowance = Number(row.allowance);
          }
          existing.updated_by = userId;

          saved = await this.warehousesRepository.save(existing);
          action = "updated";
          updated_count++;
          updated_row_numbers.push(rowNum);
        } else {
          const newWarehouse = this.warehousesRepository.create({
            warehouse_name: row.warehouse_name,
            warehouse_ifs: row.warehouse_ifs,
            warehouse_code: row.warehouse_code,
            warehouse_type_id: resolvedWarehouseTypeId,
            location_id: Number(row.location_id),
            segment_id: Number(row.segment_id),
            address: row.address ? String(row.address) : "",
            latitude: latVal !== null && !isNaN(latVal) ? latVal : null,
            longitude: longVal !== null && !isNaN(longVal) ? longVal : null,
            status_id: resolvedStatusId,
            rem_status_id: resolvedRemStatusId,
            pos_availability_id: resolvedPosAvailabilityId,
            allowance:
              row.allowance && !isNaN(Number(row.allowance))
                ? Number(row.allowance)
                : 0,
            access_key_id: accessKeyId || 1,
            created_by: userId,
            updated_by: userId,
          });

          saved = await this.warehousesRepository.save(newWarehouse);
          action = "inserted";
          inserted_count++;
          inserted_row_numbers.push(rowNum);

          // Update maps for subsequent rows in the same file
          if (saved.warehouse_ifs) {
            warehouseByIfs.set(saved.warehouse_ifs.toUpperCase(), saved);
          }
          if (saved.warehouse_code) {
            warehouseByCode.set(saved.warehouse_code.toUpperCase(), saved);
          }
          if (saved.warehouse_name) {
            warehouseByName.set(saved.warehouse_name.toUpperCase(), saved);
          }
        }

        const matchedPosType = posAvailabilities.find(
          (p) => p.id === saved.pos_availability_id,
        );
        const matchedWarehouseType = warehouseTypes.find(
          (t) => t.id === saved.warehouse_type_id,
        );

        success.push({
          id: saved.id,
          warehouse_ifs: saved.warehouse_ifs,
          warehouse_code: saved.warehouse_code,
          warehouse_name: saved.warehouse_name,
          location_id: saved.location_id,
          segment_id: saved.segment_id,
          warehouse_type_id: saved.warehouse_type_id,
          warehouse_type_name:
            matchedWarehouseType?.warehouse_type_name || null,
          pos_availability_id: saved.pos_availability_id,
          pos_availability_name: matchedPosType?.pos_availability || null,
          latitude:
            saved.latitude !== null && saved.latitude !== undefined
              ? Number(saved.latitude)
              : null,
          longitude:
            saved.longitude !== null && saved.longitude !== undefined
              ? Number(saved.longitude)
              : null,
          status_id: saved.status_id,
          status_name: STATUS_NAMES[saved.status_id] ?? "Active",
          rem_status_id: saved.rem_status_id,
          rem_status_name: STATUS_NAMES[saved.rem_status_id] ?? "Open",
          action,
          __rowNum__: rowNum,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, error: errorMessage });
      }
    }

    if (inserted_count > 0 || updated_count > 0) {
      await this.cacheInvalidationService.invalidateWarehouses();
      try {
        this.sseEventEmitter.emitCreateSignal("warehouses", 0);
      } catch (err) {
        logger.error("SSE event failed for warehouse bulk upload:", err);
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
