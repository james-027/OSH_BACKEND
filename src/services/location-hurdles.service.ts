import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Not } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { LocationHurdle } from "src/entities/LocationHurdle";
import { Location } from "src/entities/Location";
import { CreateLocationHurdleDto } from "src/dto/CreateLocationHurdleDto";
import { UpdateLocationHurdleDto } from "src/dto/UpdateLocationHurdleDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SyncLog } from "src/entities/syncLog";
import { LocationHurdleCategoriesService } from "./location-hurdle-categories.service";
import { ItemCategoriesService } from "./item-categories.service";
import { LocationsService } from "./locations.service";
import { ActionLogsService } from "./action-logs.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";
import { CommonUtilitiesService } from "./common-utilities.service";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

@Injectable()
export class LocationHurdlesService {
  constructor(
    @InjectRepository(LocationHurdle)
    private locationHurdlesRepository: Repository<LocationHurdle>,
    private usersService: UsersService,
    private lhcService: LocationHurdleCategoriesService,
    private auditTrailService: UserAuditTrailCreateService,
    private locationsService: LocationsService,
    private itemCategoriesService: ItemCategoriesService,
    private ActionLogsService: ActionLogsService,
    private sseEventEmitter: SSEEventEmitterHelper,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
  ): Promise<any[]> {
    const allowedLocationIds = await this.getAllowedLocationIds(userId, roleId);
    const query = this.locationHurdlesRepository
      .createQueryBuilder("lh")
      .innerJoinAndSelect("lh.location", "location")
      .innerJoinAndSelect("lh.status", "status")
      .leftJoinAndSelect("lh.createdBy", "createdBy")
      .leftJoinAndSelect("lh.updatedBy", "updatedBy")
      .leftJoinAndSelect(
        "lh.locationHurdleCategories",
        "locationHurdleCategories",
      )
      .leftJoinAndSelect(
        "locationHurdleCategories.itemCategory",
        "itemCategory",
      );
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("lh.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }
    const hurdles = await query.getMany();
    return hurdles.map((hurdle) => ({
      id: hurdle.id,
      location_id: hurdle.location_id,
      location_name: hurdle.location ? hurdle.location.location_name : null,
      location_rate: hurdle.location_rate,
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
        hurdle.locationHurdleCategories
          ?.filter(
            (cat) =>
              cat.status_id === 3 || cat.status_id === 6 || cat.status_id === 7,
          )
          .map((cat) => ({
            id: cat.id,
            location_id: cat.location_id,
            item_category_id: cat.item_category_id,
            item_category_code: cat.itemCategory?.code,
            item_category_name: cat.itemCategory?.name,
            status_id: cat.status_id,
          })) || [],
    }));
  }

  async findOne(id: number): Promise<any> {
    const hurdle = await this.locationHurdlesRepository.findOne({
      where: { id },
      relations: [
        "location",
        "status",
        "createdBy",
        "updatedBy",
        "locationHurdleCategories",
        "locationHurdleCategories.itemCategory",
      ],
    });
    if (!hurdle)
      throw new NotFoundException(`Location hurdle with ID ${id} not found`);
    return {
      id: hurdle.id,
      location_id: hurdle.location_id,
      location_name: hurdle.location ? hurdle.location.location_name : null,
      location_rate: hurdle.location_rate,
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
        hurdle.locationHurdleCategories
          ?.filter(
            (cat) =>
              cat.status_id === 3 || cat.status_id === 6 || cat.status_id === 7,
          )
          .map((cat) => ({
            id: cat.id,
            location_id: cat.location_id,
            item_category_id: cat.item_category_id,
            item_category_code: cat.itemCategory?.code,
            item_category_name: cat.itemCategory?.name,
            status_id: cat.status_id,
          })) || [],
    };
  }

  async create(
    createDto: CreateLocationHurdleDto,
    userId: number,
  ): Promise<LocationHurdle[]> {
    const { location_ids, item_category_ids, ...mainDto } = createDto;
    const hurdles: LocationHurdle[] = [];
    const result = [];
    for (const location_id of location_ids) {
      const newHurdle = this.locationHurdlesRepository.create({
        ...mainDto,
        location_id,
        created_by: userId,
        status_id: 1,
      });
      const saved = await this.locationHurdlesRepository.save(newHurdle);
      hurdles.push(saved);

      // Create extension categories if provided
      if (item_category_ids && item_category_ids.length > 0) {
        const categories = await this.lhcService.bulkCreateExtension(
          saved.id,
          [location_id],
          item_category_ids,
          userId,
        );
        result.push({ hurdle: saved, categories });
      } else {
        result.push({ hurdle: saved, categories: [] });
      }
    }

    // Audit trail
    await this.auditTrailService.create(
      {
        service: "LocationHurdlesService",
        method: "create",
        raw_data: JSON.stringify(createDto),
        description: `Created location hurdles for location_ids: [${location_ids}] and item_category_ids: [${item_category_ids}]`,
        status_id: 1,
      },
      userId,
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal("location_hurdles", 0);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return result;
  }

  async update(
    id: number,
    updateDto: UpdateLocationHurdleDto,
    userId: number,
  ): Promise<LocationHurdle> {
    const {
      location_ids,
      item_category_ids,
      status_id,
      ss_hurdle_qty,
      ...mainDto
    } = updateDto;
    const hurdle = await this.locationHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle) {
      throw new NotFoundException(`Location hurdle with ID ${id} not found`);
    }

    const old_status_id = hurdle.status_id;

    if (location_ids && location_ids.length === 1 && mainDto.hurdle_date) {
      const checkDuplicate = await this.locationHurdlesRepository.findOne({
        where: {
          location_id: location_ids[0],
          hurdle_date: mainDto.hurdle_date,
          id: Not(id),
        },
      });
      if (checkDuplicate) {
        throw new BadRequestException(
          "Location hurdle with this date already exists",
        );
      }
    }
    Object.assign(hurdle, mainDto, {
      updated_by: userId,
    });
    try {
      const saved = await this.locationHurdlesRepository.save(hurdle);

      // Update extension categories if provided
      if (item_category_ids && item_category_ids.length > 0) {
        const locationIds = location_ids || [hurdle.location_id];
        await this.lhcService.bulkUpdateExtension(
          saved.id,
          locationIds,
          item_category_ids,
          userId,
        );
      }

      // Audit trail
      await this.auditTrailService.create(
        {
          service: "LocationHurdlesService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated location hurdle ID: ${id}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("location_hurdles", id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return saved;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: number): Promise<void> {
    const hurdle = await this.locationHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle)
      throw new NotFoundException(`Location hurdle with ID ${id} not found`);
    await this.locationHurdlesRepository.remove(hurdle);
  }

  async toggleStatus(
    id: number,
    userId: number,
    status_id: number,
    undo_reason?: string,
  ): Promise<any> {
    const hurdle = await this.locationHurdlesRepository.findOne({
      where: { id },
    });
    if (!hurdle) {
      throw new NotFoundException(`Location hurdle with ID ${id} not found`);
    }
    const newStatusId = status_id;

    let newStatusName = "Pending";
    if (status_id === 7) newStatusName = "Approved";
    else if (status_id === 3) newStatusName = "Back to Pending";
    else if (status_id === 6) newStatusName = "For Approval";

    await this.locationHurdlesRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
      undo_reason: undo_reason || null,
    });
    // Optionally, update all related extension categories' status
    await this.lhcService.updateStatusByLocationHurdleId(
      id,
      newStatusId,
      userId,
    );
    // Audit trail
    await this.auditTrailService.create(
      {
        service: "LocationHurdlesService",
        method: "toggleStatus",
        raw_data: JSON.stringify({ id }),
        description: `Toggled status for location hurdle id: ${id} to ${newStatusName}`,
        status_id: 1,
      },
      userId,
    );

    // Get action ID from status
    const action_id =
      await this.ActionLogsService.get_action_id_from_status(newStatusId);
    // Action log
    await this.ActionLogsService.logAction({
      action_id: action_id,
      ref_id: id,
      module_id: 17, // Assuming location hurdles has module_id 17
      description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""} location hurdle.`,
      raw_data: JSON.stringify({ id: id, status_id: newStatusId }),
      created_by: userId,
    });

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("location_hurdles", id);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return this.findOne(id);
  }

  async toggleBulkStatus(
    ids: number[],
    status_id: number,
    userId: number,
    undo_reason?: string,
  ): Promise<any[]> {
    const hurdles = await this.locationHurdlesRepository.find({
      where: { id: In(ids) },
    });

    if (hurdles.length === 0) {
      throw new NotFoundException(
        "No location hurdles found for the given IDs",
      );
    }

    const results = [];

    for (const hurdle of hurdles) {
      let newStatusName = "Pending";
      if (status_id === 7) newStatusName = "Approved";
      else if (status_id === 3) newStatusName = "Back to Pending";
      else if (status_id === 6) newStatusName = "For Approval";

      await this.locationHurdlesRepository.update(hurdle.id, {
        status_id,
        updated_by: userId,
        undo_reason: undo_reason || null,
      });

      // Update related categories status
      await this.lhcService.updateStatusByLocationHurdleId(
        hurdle.id,
        status_id,
        userId,
      );

      // Audit trail
      await this.auditTrailService.create(
        {
          service: "LocationHurdlesService",
          method: "toggleBulkStatus",
          raw_data: JSON.stringify({ id: hurdle.id }),
          description: `Toggled status for location hurdle id: ${hurdle.id} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      // Action log
      const action_id =
        await this.ActionLogsService.get_action_id_from_status(status_id);
      await this.ActionLogsService.logAction({
        action_id: action_id,
        ref_id: hurdle.id,
        module_id: 17,
        description: `${newStatusName} ${undo_reason ? `with reason: ${undo_reason}` : ""} location hurdle.`,
        raw_data: JSON.stringify({
          id: hurdle.id,
          status_id,
        }),
        created_by: userId,
      });

      results.push(await this.findOne(hurdle.id));
    }

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("location_hurdles", 0);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return results;
  }

  async findOneHistory(ref_id: number) {
    // Note: SyncLog doesn't have ref_id field, filter records from action logs or audit trail instead
    // For now, return empty array or implement with audit trail service
    return [];
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
    const errors = [];

    const locations = await this.locationsService.findAll();
    const itemCategories = await this.itemCategoriesService.findAll();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const location = locations.find(
        (l) =>
          l.location_code === record.location_code ||
          l.location_name === record.location_name,
      );

      if (!location) {
        errors.push({
          row: i + 2,
          error: `Location not found: ${record.location_name || record.location_code} (Row ${i + 2})`,
        });
        continue;
      }

      // Location permission check
      if (allowedLocationIds && !allowedLocationIds.includes(location.id)) {
        errors.push({
          row: i + 2,
          error: `You do not have permission to upload hurdles for location ${location.location_name}, based on your allowed location.`,
        });
        continue;
      }

      const itemCategory = itemCategories.find(
        (c) => c.code === record.item_category_code,
      );
      if (!itemCategory) {
        errors.push({
          row: i + 2,
          error: `Invalid ITEM CATEGORY CODE: ${record.item_category_code}`,
        });
        continue;
      }

      try {
        // Robust UTC date handling for Excel upload
        let formattedDate: string;
        if (record.hurdle_date) {
          const d = dayjs.utc(record.hurdle_date);
          formattedDate = d.startOf("month").format("YYYY-MM-01");
        } else {
          formattedDate = null;
        }

        try {
          // Check if hurdle already exists
          const existing = await this.locationHurdlesRepository.findOne({
            where: {
              location_id: location.id,
              hurdle_date: formattedDate,
            },
          });

          if (existing) {
            // UPDATE
            try {
              await this.update(
                existing.id,
                {
                  location_ids: [location.id],
                  ss_hurdle_qty: record.ss_hurdle_qty,
                  hurdle_date: formattedDate,
                  location_rate: record.location_rate || 0,
                  item_category_ids: [itemCategory.id],
                },
                userId,
              );
              updated_count++;
              updated_row_numbers.push(i + 2);
              success.push({
                location_code: location.location_code,
                location_name: location.location_name,
                item_category_code: record.item_category_code,
                hurdle_qty: record.ss_hurdle_qty,
                hurdle_month: formattedDate,
                __rowNum__: i + 2,
              });
            } catch (updateErr) {
              errors.push({ row: i + 2, error: updateErr.message });
            }
          } else {
            // CREATE
            await this.create(
              {
                location_ids: [location.id],
                ss_hurdle_qty: record.ss_hurdle_qty,
                hurdle_date: formattedDate,
                location_rate: record.location_rate || 0,
                item_category_ids: [itemCategory.id],
              },
              userId,
            );
            inserted_count++;
            inserted_row_numbers.push(i + 2);
            success.push({
              location_code: location.location_code,
              location_name: location.location_name,
              item_category_code: record.item_category_code,
              hurdle_qty: record.ss_hurdle_qty,
              hurdle_month: formattedDate,
              __rowNum__: i + 2,
            });
          }
        } catch (err) {
          errors.push({ row: i + 2, error: err.message });
        }
      } catch (err) {
        errors.push({ row: i + 2, error: err.message });
      }
    }

    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("location_hurdles", 0);
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
}
