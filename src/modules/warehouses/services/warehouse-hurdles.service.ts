import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import { WarehouseHurdle } from "../../../entities/WarehouseHurdle";
import { CreateWarehouseHurdleDto } from "../dto/CreateWarehouseHurdleDto";
import { UpdateWarehouseHurdleDto } from "../dto/UpdateWarehouseHurdleDto";
import { UsersService } from "../../users/services/users.service";
import { WarehouseHurdleCategoriesService } from "./warehouse-hurdle-categories.service";
import { Inject } from "@nestjs/common";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { WarehousesService } from "./warehouses.service";
import { ItemCategoriesService } from "src/modules/items/services/item-categories.service";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";

const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

dayjs.extend(utc);

@Injectable()
export class WarehouseHurdlesService {
  constructor(
    @InjectRepository(WarehouseHurdle)
    private warehouseHurdlesRepository: Repository<WarehouseHurdle>,
    private usersService: UsersService,
    @Inject(WarehouseHurdleCategoriesService)
    private whcService: WarehouseHurdleCategoriesService,
    @Inject(UserAuditTrailCreateService)
    private auditTrailService: UserAuditTrailCreateService,
    private warehousesService: WarehousesService,
    private itemCategoriesService: ItemCategoriesService,
    @Inject(ActionLogsService)
    private ActionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
    hurdleDate?: string,
  ): Promise<any[]> {
    const allowedLocationIds = await this.getAllowedLocationIds(userId, roleId);
    const query = this.warehouseHurdlesRepository
      .createQueryBuilder("wh")
      .innerJoinAndSelect("wh.warehouse", "warehouse")
      .innerJoinAndSelect("warehouse.location", "location")
      .innerJoinAndSelect("wh.status", "status")
      .leftJoinAndSelect("wh.createdBy", "createdBy")
      .leftJoinAndSelect("wh.updatedBy", "updatedBy")
      .leftJoinAndSelect(
        "wh.warehouseHurdleCategories",
        "warehouseHurdleCategories",
      )
      .leftJoinAndSelect(
        "warehouseHurdleCategories.itemCategory",
        "itemCategory",
      );
    if (accessKeyId !== undefined) {
      query.andWhere("warehouse.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    // Filter by hurdle_date if provided
    if (hurdleDate) {
      query.andWhere("wh.hurdle_date = :hurdleDate", { hurdleDate });
    }
    const hurdles = await query.getMany();
    return hurdles.map((hurdle) => ({
      id: hurdle.id,
      warehouse_id: hurdle.warehouse_id,
      warehouse_ifs: hurdle.warehouse ? hurdle.warehouse.warehouse_ifs : null,
      warehouse_name: hurdle.warehouse ? hurdle.warehouse.warehouse_name : null,
      location_id: hurdle.warehouse ? hurdle.warehouse.location_id : null,
      location_name:
        hurdle.warehouse && hurdle.warehouse.location
          ? hurdle.warehouse.location.location_name
          : null,
      warehouse_rate: hurdle.warehouse_rate,
      ss_hurdle_qty: hurdle.ss_hurdle_qty,
      hurdle_date: hurdle.hurdle_date
        ? dayjs(hurdle.hurdle_date).format("MMMM YYYY")
        : null,
      status_id: hurdle.status_id,
      status_name: hurdle.status ? hurdle.status.status_name : null,
      undo_reason: hurdle.undo_reason || null,
      created_at: hurdle.created_at,
      created_by: hurdle.created_by,
      updated_by: hurdle.updated_by,
      modified_at: hurdle.modified_at,
      created_user: hurdle.createdBy
        ? `${hurdle.createdBy.first_name} ${hurdle.createdBy.last_name}`
        : null,
      updated_user: hurdle.updatedBy
        ? `${hurdle.updatedBy.first_name} ${hurdle.updatedBy.last_name}`
        : null,
      extension_categories:
        hurdle.warehouseHurdleCategories
          ?.filter(
            (cat) =>
              cat.status_id === 3 || cat.status_id === 6 || cat.status_id === 7,
          )
          .map((cat) => ({
            id: cat.id,
            warehouse_id: cat.warehouse_id,
            item_category_id: cat.item_category_id,
            item_category_code: cat.itemCategory?.code,
            item_category_name: cat.itemCategory?.name,
            status_id: cat.status_id,
          })) || [],
    }));
  }

  async findOne(id: number): Promise<any> {
    const hurdle = await this.warehouseHurdlesRepository.findOne({
      where: { id },
      relations: [
        "warehouse",
        "status",
        "createdBy",
        "updatedBy",
        "warehouseHurdleCategories",
        "warehouseHurdleCategories.itemCategory",
      ],
    });
    if (!hurdle) throw new NotFoundException("Warehouse hurdle not found");
    return {
      id: hurdle.id,
      warehouse_id: hurdle.warehouse_id,
      warehouse_name: hurdle.warehouse ? hurdle.warehouse.warehouse_name : null,
      warehouse_rate: hurdle.warehouse_rate,
      ss_hurdle_qty: hurdle.ss_hurdle_qty,
      hurdle_date: hurdle.hurdle_date,
      status_id: hurdle.status_id,
      status_name: hurdle.status ? hurdle.status.status_name : null,
      created_at: hurdle.created_at,
      created_by: hurdle.created_by,
      updated_by: hurdle.updated_by,
      modified_at: hurdle.modified_at,
      created_user: hurdle.createdBy
        ? `${hurdle.createdBy.first_name} ${hurdle.createdBy.last_name}`
        : null,
      updated_user: hurdle.updatedBy
        ? `${hurdle.updatedBy.first_name} ${hurdle.updatedBy.last_name}`
        : null,
      extension_categories:
        hurdle.warehouseHurdleCategories
          ?.filter(
            (cat) =>
              cat.status_id === 3 || cat.status_id === 6 || cat.status_id === 7,
          )
          .map((cat) => ({
            id: cat.id,
            warehouse_id: cat.warehouse_id,
            item_category_id: cat.item_category_id,
            item_category_code: cat.itemCategory?.code,
            item_category_name: cat.itemCategory?.name,
            status_id: cat.status_id,
          })) || [],
    };
  }

  async create(
    createDto: CreateWarehouseHurdleDto,
    userId: number,
  ): Promise<WarehouseHurdle[]> {
    const { warehouse_ids, item_category_ids, ...mainDto } = createDto;
    const hurdles: WarehouseHurdle[] = [];
    const result = [];
    for (const warehouse_id of warehouse_ids) {
      // Duplicate check
      const exists = await this.warehouseHurdlesRepository.findOne({
        where: { warehouse_id, hurdle_date: mainDto.hurdle_date },
      });
      if (exists) {
        throw new BadRequestException(
          `Duplicate hurdle for warehouse_id ${warehouse_id} and hurdle_date ${mainDto.hurdle_date}`,
        );
      }
      const hurdle = this.warehouseHurdlesRepository.create({
        ...mainDto,
        warehouse_id,
        created_by: userId,
        updated_by: userId,
      });
      const saved = await this.warehouseHurdlesRepository.save(hurdle);
      if (item_category_ids) {
        await this.whcService.bulkCreateExtension(
          saved.id,
          [warehouse_id],
          item_category_ids,
          userId,
        );
      }
      // Action log
      await this.ActionLogsService.logAction({
        action_id: 1, // add
        ref_id: saved.id,
        module_id: 16, // STORE HURDLES
        description: `Created warehouse hurdle with hurdle qty ${saved.ss_hurdle_qty} and status ${saved.status_id === 3 ? "Pending" : "For Approval"}`,
        raw_data: JSON.stringify(mainDto),
        created_by: userId,
      });
      hurdles.push(saved);
      result.push(saved);
    }
    // Audit trail
    await this.auditTrailService.create(
      {
        service: "WarehouseHurdlesService",
        method: "create",
        raw_data: JSON.stringify(createDto),
        description: `Created warehouse hurdles for warehouse_ids: [${warehouse_ids}] and item_category_ids: [${item_category_ids}]`,
        status_id: 1,
      },
      userId,
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal("warehouse_hurdles", 0);
      await this.cacheInvalidationService.invalidateWarehouseHurdles();
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return result;
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseHurdleDto,
    userId: number,
  ): Promise<WarehouseHurdle> {
    const {
      warehouse_ids,
      item_category_ids,
      status_id,
      ss_hurdle_qty,
      ...mainDto
    } = updateDto;
    const hurdle = await this.warehouseHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle) {
      throw new NotFoundException("Warehouse hurdle not found");
    }

    const old_status_id = hurdle.status_id;

    if (warehouse_ids && warehouse_ids.length === 1 && mainDto.hurdle_date) {
      const exists = await this.warehouseHurdlesRepository.findOne({
        where: {
          warehouse_id: warehouse_ids[0],
          hurdle_date: mainDto.hurdle_date,
          id: Not(id),
        },
      });
      if (exists) {
        throw new BadRequestException(
          `Duplicate hurdle for warehouse_id ${warehouse_ids[0]} and hurdle_date ${mainDto.hurdle_date}`,
        );
      }
      hurdle.warehouse_id = warehouse_ids[0];
      hurdle.ss_hurdle_qty = ss_hurdle_qty;
      hurdle.status_id = status_id;
    }
    Object.assign(hurdle, mainDto, {
      updated_by: userId,
    });
    try {
      const saved = await this.warehouseHurdlesRepository.save(hurdle);
      if (warehouse_ids && item_category_ids) {
        await this.whcService.bulkUpdateExtension(
          saved.id,
          warehouse_ids,
          item_category_ids,
          userId,
        );
      }
      // Audit trail
      await this.auditTrailService.create(
        {
          service: "WarehouseHurdlesService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated warehouse hurdle id: ${id}`,
          status_id: 1,
        },
        userId,
      );

      const status_change =
        old_status_id !== status_id && status_id !== undefined;
      let description = `Updated warehouse hurdle with hurdle qty ${ss_hurdle_qty}`;
      if (status_change) {
        const newStatusName = status_id === 3 ? "Pending" : "For Approval";
        const oldStatusName = old_status_id === 3 ? "Pending" : "For Approval";
        description = `Updated status from ${oldStatusName} to ${newStatusName} with hurdle qty ${ss_hurdle_qty}`;
      }
      // Action log
      await this.ActionLogsService.logAction({
        action_id: 2, // edit
        ref_id: saved.id,
        module_id: 16, // STORE HURDLES
        description: description,
        raw_data: JSON.stringify(mainDto),
        created_by: userId,
      });

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_hurdles", saved.id);
        await this.cacheInvalidationService.invalidateWarehouseHurdles();
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return saved;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async remove(id: number): Promise<void> {
    const hurdle = await this.warehouseHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle) throw new NotFoundException("Warehouse hurdle not found");
    await this.warehouseHurdlesRepository.remove(hurdle);
  }

  async toggleStatus(
    id: number,
    userId: number,
    status_id: number,
    undo_reason?: string,
  ): Promise<any> {
    const hurdle = await this.warehouseHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle) {
      throw new NotFoundException(`Warehouse hurdle with ID ${id} not found`);
    }
    const newStatusId = status_id;

    let newStatusName = "Pending";
    if (status_id === 7) newStatusName = "Approved";
    else if (status_id === 3) newStatusName = "Back to Pending";
    else if (status_id === 6) newStatusName = "For Approval";

    await this.warehouseHurdlesRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
      undo_reason: undo_reason || null,
    });
    // Optionally, update all related extension categories' status
    await this.whcService.updateStatusByWarehouseHurdleId(
      id,
      newStatusId,
      userId,
    );
    // Audit trail
    await this.auditTrailService.create(
      {
        service: "WarehouseHurdlesService",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id }),
        description: `Toggled status for warehouse hurdle id: ${id} to ${newStatusName}`,
        status_id: 1,
      },
      userId,
    );

    // Get action ID from status
    const action_id =
      await this.ActionLogsService.get_action_id_from_status(newStatusId);
    // Action log
    await this.ActionLogsService.logAction({
      action_id: action_id, // dynamic
      ref_id: id,
      module_id: 16, // STORE HURDLES
      description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""} warehouse hurdle.`,
      raw_data: JSON.stringify({ id: id, status_id: newStatusId }),
      created_by: userId,
    });
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_hurdles", id);
      await this.cacheInvalidationService.invalidateWarehouseHurdles();
    } catch (err) {
      logger.error("[SSE] SSE event failed for update:", err);
    }
    return this.findOne(id);
  }

  async toggleBulkStatus(
    ids: number[],
    status_id: number,
    userId: number,
    undo_reason?: string,
  ): Promise<any[]> {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("No warehouse hurdle IDs provided");
    }

    // Update all hurdles in bulk
    await this.warehouseHurdlesRepository
      .createQueryBuilder()
      .update()
      .set({
        status_id,
        updated_by: userId,
        undo_reason: undo_reason || null,
      })
      .whereInIds(ids)
      .execute();

    // Cascade update to all related warehouse_hurdle_categories
    await this.whcService.updateStatusByWarehouseHurdleIds(
      ids,
      status_id,
      userId,
    );

    // Action log for each hurdle
    const newStatusName =
      status_id === 7
        ? "Approved"
        : status_id === 3
          ? "Back to Pending"
          : status_id === 6
            ? "For Approval"
            : "Pending";

    // Get action ID from status
    const action_id =
      await this.ActionLogsService.get_action_id_from_status(status_id);

    for (const id of ids) {
      await this.ActionLogsService.logAction({
        action_id: action_id,
        ref_id: id,
        module_id: 16, // STORE HURDLES
        description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""} warehouse hurdle.`,
        raw_data: JSON.stringify({ id, status_id }),
        created_by: userId,
      });
    }

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "WarehouseHurdlesService",
        method: "toggleBulkStatus",
        raw_data: JSON.stringify({ ids, status_id, undo_reason }),
        description: `Bulk toggled status for warehouse hurdle ids: [${ids.join(", ")}] to status_id: ${status_id}`,
        status_id: 1,
      },
      userId,
    );
    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_hurdles", 0);
      await this.cacheInvalidationService.invalidateWarehouseHurdles();
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }

    // Return updated hurdles
    return Promise.all(ids.map((id) => this.findOne(id)));
  }

  async findOneHistory(ref_id: number) {
    const module_id = 16;
    return this.ActionLogsService.findPerModuleRefID(module_id, ref_id);
  }

  async getAllowedLocationIds(
    userId?: number,
    roleId?: number,
  ): Promise<number[]> {
    if (!userId || !roleId) {
      return [];
    }
    return await this.commonUtilitiesService.getUserAllowedLocationIds(
      userId,
      roleId,
    );
  }

  async bulkUploadFromExcel(
    records: any[],
    userId: number,
    allowedLocationIds?: number[],
  ) {
    let inserted_count = 0;
    let updated_count = 0;
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const success: any[] = [];

    const warehouses = await this.warehousesService.findAll();
    const itemCategories = await this.itemCategoriesService.findAll();
    const results = [];
    const errors = [];
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const warehouse = warehouses.find(
        (w) => w.warehouse_ifs == row.warehouse_ifs,
      );
      if (!warehouse) {
        errors.push({
          row: i + 2,
          error: `Store not found: STORE IFS ${row.warehouse_ifs} (Row ${i + 2})`,
        });
        continue;
      }
      // Location permission check
      if (
        allowedLocationIds &&
        !allowedLocationIds.includes(warehouse.location_id)
      ) {
        errors.push({
          row: i + 2,
          error: `You do not have permission to upload hurdles for STORE IFS ${row.warehouse_ifs} (${warehouse.warehouse_name}), based on your allowed location.`,
        });
        continue;
      }
      const itemCategory = itemCategories.find(
        (c) => c.code == row.item_category_code,
      );
      if (!itemCategory) {
        errors.push({
          row: i + 2,
          error: `Invalid ITEM CATEGORY CODE: ${row.item_category_code}`,
        });
        continue;
      }
      try {
        // Robust UTC date handling for Excel upload
        let formattedDate: string;
        if (row.hurdle_date) {
          const d = dayjs.utc(row.hurdle_date);
          formattedDate = d.startOf("month").format("YYYY-MM-01");
        } else {
          formattedDate = null;
        }
        try {
          // CALL CREATE SERVICE
          await this.create(
            {
              ss_hurdle_qty: row.ss_hurdle_qty,
              hurdle_date: formattedDate,
              warehouse_ids: [warehouse.id],
              item_category_ids: [itemCategory.id],
              status_id: 3, // pending status
            },
            userId,
          );
          inserted_count++;
          inserted_row_numbers.push(i + 2);
          success.push({
            store_ifs: row.warehouse_ifs,
            store_name: warehouse.warehouse_name,
            item_category_code: row.item_category_code,
            hurdle_qty: row.ss_hurdle_qty,
            hurdle_month: formattedDate,
            __rowNum__: i + 2,
          });
        } catch (err) {
          if (
            err instanceof BadRequestException &&
            err.message &&
            err.message.includes("Duplicate hurdle for warehouse_id")
          ) {
            const existing = await this.warehouseHurdlesRepository.findOne({
              where: {
                warehouse_id: warehouse.id,
                hurdle_date: formattedDate,
              },
            });
            if (existing) {
              try {
                // CALL UPDATE SERVICE
                await this.update(
                  existing.id,
                  {
                    ss_hurdle_qty: row.ss_hurdle_qty,
                    hurdle_date: formattedDate,
                    warehouse_ids: [warehouse.id],
                    item_category_ids: [itemCategory.id],
                    status_id: 3, // pending status
                  },
                  userId,
                );
                updated_count++;
                updated_row_numbers.push(i + 2);
                success.push({
                  store_ifs: row.warehouse_ifs,
                  store_name: warehouse.warehouse_name,
                  item_category_code: row.item_category_code,
                  hurdle_qty: row.ss_hurdle_qty,
                  hurdle_month: formattedDate,
                  __rowNum__: i + 2,
                });
              } catch (updateErr) {
                const updateError = updateErr as Error;
                errors.push({ row: i + 2, error: updateError.message });
              }
            } else {
              errors.push({
                row: i + 2,
                error: "Duplicate found but record not found for update.",
              });
            }
          } else {
            const rowErr = err as Error;
            errors.push({ row: i + 2, error: rowErr.message });
          }
        }
      } catch (err) {
        const error = err as Error;
        errors.push({ row: i + 2, error: error.message });
      }
    }
    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_hurdles", 0);
        await this.cacheInvalidationService.invalidateWarehouseHurdles();
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
