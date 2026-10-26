import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Warehouse } from "../../../entities/Warehouse";
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
      logger.warn("Failed to write action logs for bulk warehouse status toggle:", err);
    }

    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "WarehousesService",
        method: "toggleBulkStatus",
        raw_data: JSON.stringify({ ids, rem_status_id: status_id, undo_reason }),
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
}
