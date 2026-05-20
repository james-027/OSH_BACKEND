import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WarehouseEmployee } from "../../../entities/WarehouseEmployee";
import { CreateWarehouseEmployeeDto } from "../dto/CreateWarehouseEmployeeDto";
import { UpdateWarehouseEmployeeDto } from "../dto/UpdateWarehouseEmployeeDto";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";
import { Warehouse } from "src/entities/Warehouse";
import { parseToFirstDayOfMonth } from "../../../utils/date.utils";
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

@Injectable()
export class WarehouseEmployeesService {
  constructor(
    @InjectRepository(WarehouseEmployee)
    private warehouseEmployeesRepository: Repository<WarehouseEmployee>,
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  }

  async findAll(
    accessKeyId?: number,
    userId?: number,
    roleId?: number,
    assignmentDate?: string,
  ): Promise<any[]> {
    let allowedLocationIds: number[] | undefined = undefined;
    if (userId && roleId) {
      allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId,
        );
    }
    const query = this.warehouseEmployeesRepository
      .createQueryBuilder("we")
      .leftJoinAndSelect("we.warehouse", "warehouse")
      .leftJoinAndSelect("warehouse.location", "location")
      .leftJoinAndSelect("we.assignedSs", "assignedSs")
      .leftJoinAndSelect("we.assignedAh", "assignedAh")
      .leftJoinAndSelect("we.assignedBch", "assignedBch")
      .leftJoinAndSelect("we.assignedGbch", "assignedGbch")
      .leftJoinAndSelect("we.assignedRh", "assignedRh")
      .leftJoinAndSelect("we.assignedGrh", "assignedGrh")
      .leftJoinAndSelect("we.status", "status")
      .leftJoinAndSelect("we.createdBy", "createdBy")
      .leftJoinAndSelect("we.updatedBy", "updatedBy");
    if (accessKeyId !== undefined) {
      query.andWhere("we.access_key_id = :accessKeyId", { accessKeyId });
    }
    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    } else {
      query.andWhere("1=0"); // No access to any records if no allowed locations
    }
    if (assignmentDate) {
      query.andWhere("we.assignment_date = :assignmentDate", {
        assignmentDate,
      });
    }
    const records = await query.getMany();
    return records.map((rec) => ({
      id: rec.id,
      warehouse_id: rec.warehouse_id,
      warehouse_ifs: rec.warehouse ? rec.warehouse.warehouse_ifs : null,
      warehouse_name: rec.warehouse ? rec.warehouse.warehouse_name : null,
      location_id: rec.warehouse ? rec.warehouse.location_id : null,
      location_name:
        rec.warehouse && rec.warehouse.location
          ? rec.warehouse.location.location_name
          : null,
      assignment_date: rec.assignment_date
        ? dayjs(rec.assignment_date).format("MMMM YYYY")
        : null,
      assigned_ss: rec.assigned_ss,
      assigned_ss_name: rec.assignedSs
        ? `${rec.assignedSs.employee_first_name} ${rec.assignedSs.employee_last_name}`
        : null,
      assigned_ah: rec.assigned_ah,
      assigned_ah_name: rec.assignedAh
        ? `${rec.assignedAh.employee_first_name} ${rec.assignedAh.employee_last_name}`
        : null,
      assigned_bch: rec.assigned_bch,
      assigned_bch_name: rec.assignedBch
        ? `${rec.assignedBch.employee_first_name} ${rec.assignedBch.employee_last_name}`
        : null,
      assigned_gbch: rec.assigned_gbch,
      assigned_gbch_name: rec.assignedGbch
        ? `${rec.assignedGbch.employee_first_name} ${rec.assignedGbch.employee_last_name}`
        : null,
      assigned_rh: rec.assigned_rh,
      assigned_rh_name: rec.assignedRh
        ? `${rec.assignedRh.employee_first_name} ${rec.assignedRh.employee_last_name}`
        : null,
      assigned_grh: rec.assigned_grh,
      assigned_grh_name: rec.assignedGrh
        ? `${rec.assignedGrh.employee_first_name} ${rec.assignedGrh.employee_last_name}`
        : null,
      status_id: rec.status_id,
      status_name: rec.status ? rec.status.status_name : null,
      created_at: rec.created_at,
      created_by: rec.created_by,
      updated_by: rec.updated_by,
      modified_at: rec.modified_at,
      created_user: rec.createdBy
        ? `${rec.createdBy.first_name} ${rec.createdBy.last_name}`
        : null,
      updated_user: rec.updatedBy
        ? `${rec.updatedBy.first_name} ${rec.updatedBy.last_name}`
        : null,
    }));
  }

  /**
   * Get all warehouses in specified locations that do NOT have a warehouse_employees
   * record for the given assignment_date.
   * @param locationIds Array of location IDs to filter warehouses
   * @param assignmentDate Assignment date in YYYY-MM-01 format
   * @returns Array of warehouses with minimal fields: id, warehouse_name, warehouse_ifs, warehouse_code
   */
  async getWarehousesWithNoRecord(
    locationIds: number[],
    assignmentDate: string,
  ): Promise<any[]> {
    // Use NOT IN subquery for optimal performance - avoids expensive LEFT JOIN
    const warehouses = await this.warehousesRepository
      .createQueryBuilder("w")
      .select([
        "w.id AS id",
        "w.warehouse_name AS warehouse_name",
        "w.warehouse_ifs AS warehouse_ifs",
        "w.warehouse_code AS warehouse_code",
      ])
      .distinct(true)
      .where("w.location_id IN (:...locationIds)", { locationIds })
      .andWhere("w.status_id = :statusId", { statusId: 1 })
      .andWhere(
        `w.id NOT IN (
          SELECT warehouse_id FROM warehouse_employees 
          WHERE assignment_date = :assignmentDate
        )`,
        { assignmentDate },
      )
      .orderBy("w.warehouse_name", "ASC")
      .getRawMany();

    return warehouses;
  }

  async findOne(id: number): Promise<any> {
    const rec = await this.warehouseEmployeesRepository.findOne({
      where: { id },
      relations: [
        "warehouse",
        "assignedSs",
        "assignedAh",
        "assignedBch",
        "assignedGbch",
        "assignedRh",
        "assignedGrh",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    if (!rec)
      throw new NotFoundException("Warehouse employee record not found");
    return {
      id: rec.id,
      warehouse_id: rec.warehouse_id,
      warehouse_name: rec.warehouse ? rec.warehouse.warehouse_name : null,
      assignment_date: rec.assignment_date,
      assigned_ss: rec.assigned_ss,
      assigned_ss_name: rec.assignedSs
        ? `${rec.assignedSs.employee_first_name} ${rec.assignedSs.employee_last_name}`
        : null,
      assigned_ah: rec.assigned_ah,
      assigned_ah_name: rec.assignedAh
        ? `${rec.assignedAh.employee_first_name} ${rec.assignedAh.employee_last_name}`
        : null,
      assigned_bch: rec.assigned_bch,
      assigned_bch_name: rec.assignedBch
        ? `${rec.assignedBch.employee_first_name} ${rec.assignedBch.employee_last_name}`
        : null,
      assigned_gbch: rec.assigned_gbch,
      assigned_gbch_name: rec.assignedGbch
        ? `${rec.assignedGbch.employee_first_name} ${rec.assignedGbch.employee_last_name}`
        : null,
      assigned_rh: rec.assigned_rh,
      assigned_rh_name: rec.assignedRh
        ? `${rec.assignedRh.employee_first_name} ${rec.assignedRh.employee_last_name}`
        : null,
      assigned_grh: rec.assigned_grh,
      assigned_grh_name: rec.assignedGrh
        ? `${rec.assignedGrh.employee_first_name} ${rec.assignedGrh.employee_last_name}`
        : null,
      status_id: rec.status_id,
      status_name: rec.status ? rec.status.status_name : null,
      created_at: rec.created_at,
      created_by: rec.created_by,
      updated_by: rec.updated_by,
      modified_at: rec.modified_at,
      created_user: rec.createdBy
        ? `${rec.createdBy.first_name} ${rec.createdBy.last_name}`
        : null,
      updated_user: rec.updatedBy
        ? `${rec.updatedBy.first_name} ${rec.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createDto: CreateWarehouseEmployeeDto,
    userId: number,
    skipAuditTrail: boolean = false,
  ): Promise<WarehouseEmployee> {
    // Uniqueness check - warehouse_id + assignment_date must be unique
    const exists = await this.warehouseEmployeesRepository.findOne({
      where: {
        warehouse_id: createDto.warehouse_id,
        assignment_date: createDto.assignment_date,
      },
    });
    if (exists) {
      throw new BadRequestException(
        `A record with this warehouse (ID: ${createDto.warehouse_id}) and assignment date (${createDto.assignment_date}) already exists.`,
      );
    }
    const rec = this.warehouseEmployeesRepository.create({
      ...createDto,
      access_key_id: createDto.access_key_id,
      assignment_date: createDto.assignment_date,
      assigned_gbch: createDto.assigned_gbch ?? null,
      assigned_grh: createDto.assigned_grh ?? null,
      created_by: userId,
      updated_by: userId,
    });
    try {
      const saved = await this.warehouseEmployeesRepository.save(rec);

      if (!skipAuditTrail) {
        // Audit trail
        await this.userAuditTrailCreateService.create(
          {
            service: "WarehouseEmployeesService",
            method: "create",
            raw_data: JSON.stringify({ ...createDto }),
            description: `Created warehouse employee for warehouse ID: ${saved.warehouse_id} - ${saved.warehouse ? saved.warehouse.warehouse_name : ""}`,
            status_id: 1,
          },
          userId,
        );
      }
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_employees", saved.id);
        await this.cacheInvalidationService.invalidateWarehouseEmployees();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
      return saved;
    } catch (error) {
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseEmployeeDto,
    userId: number,
    skipAuditTrail: boolean = false,
  ): Promise<WarehouseEmployee> {
    const rec = await this.findOne(id);

    // assignment_date is immutable - prevent updates
    if (
      updateDto.assignment_date !== undefined &&
      updateDto.assignment_date !== rec.assignment_date
    ) {
      throw new BadRequestException(
        "assignment_date is immutable and cannot be changed after creation.",
      );
    }

    // Only check for warehouse_id + assignment_date uniqueness
    if (
      updateDto.warehouse_id !== undefined &&
      updateDto.warehouse_id !== rec.warehouse_id
    ) {
      const exists = await this.warehouseEmployeesRepository.findOne({
        where: {
          warehouse_id: updateDto.warehouse_id,
          assignment_date: rec.assignment_date,
        },
      });
      if (exists && exists.id !== id) {
        // Update the existing record with updateDto values
        Object.assign(exists, updateDto, {
          assigned_gbch:
            updateDto.assigned_gbch ?? exists.assigned_gbch ?? null,
          assigned_grh: updateDto.assigned_grh ?? exists.assigned_grh ?? null,
          access_key_id: updateDto.access_key_id ?? exists.access_key_id,
          updated_by: userId,
        });
        try {
          return await this.warehouseEmployeesRepository.save(exists);
        } catch (error) {
          throw new BadRequestException(this.getErrorMessage(error));
        }
      }
    }

    Object.assign(rec, updateDto, {
      assignment_date: rec.assignment_date, // Ensure assignment_date is not updated
      assigned_gbch: updateDto.assigned_gbch ?? rec.assigned_gbch ?? null,
      assigned_grh: updateDto.assigned_grh ?? rec.assigned_grh ?? null,
      access_key_id: updateDto.access_key_id ?? rec.access_key_id,
      updated_by: userId,
    });
    try {
      await this.warehouseEmployeesRepository.update(id, {
        ...updateDto,
        updated_by: userId,
      });

      if (!skipAuditTrail) {
        // Audit trail
        await this.userAuditTrailCreateService.create(
          {
            service: "WarehouseEmployeesService",
            method: "update",
            raw_data: JSON.stringify({ ...updateDto }),
            description: `Updated warehouse employee ID: ${id} - ${rec.warehouse ? rec.warehouse.warehouse_name : ""}`,
            status_id: 1,
          },
          userId,
        );
      }
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("warehouse_employees", id);
        await this.cacheInvalidationService.invalidateWarehouseEmployees();
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
      return this.findOne(id);
    } catch (error) {
      throw new BadRequestException(this.getErrorMessage(error));
    }
  }

  async remove(id: number): Promise<void> {
    const rec = await this.warehouseEmployeesRepository.findOne({
      where: { id },
    });
    if (!rec)
      throw new NotFoundException("Warehouse employee record not found");
    await this.warehouseEmployeesRepository.remove(rec);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const rec = await this.warehouseEmployeesRepository.findOne({
      where: { id },
    });
    if (!rec) {
      throw new NotFoundException(
        `Warehouse employee record with ID ${id} not found`,
      );
    }
    const newStatusId = rec.status_id === 1 ? 2 : 1;
    const newStatusName = newStatusId === 1 ? "Active" : "Inactive";
    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    await this.warehouseEmployeesRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "WarehouseEmployeesService",
        method: "toggleStatus",
        raw_data: JSON.stringify({
          id,
          prev_status_id: rec.status_id,
          new_status_id: newStatusId,
        }),
        description: `Toggled status to ${newStatusName} for warehouse employee ID: ${id} - ${rec.warehouse ? rec.warehouse.warehouse_name : ""}`,
        status_id: newStatusId,
      },
      userId,
    );

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal("warehouse_employees", id);
      await this.cacheInvalidationService.invalidateWarehouseEmployees();
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }

    return this.findOne(id);
  }

  /**
   * Bulk upload warehouse employees.
   * Accepts an array of CreateWarehouseEmployeeDto objects.
   * assignment_date is immutable - identified by warehouse_id + assignment_date
   * Returns a summary with successes and errors.
   */
  async bulkUpload(
    records: (CreateWarehouseEmployeeDto & { __rowNum__?: number })[],
    userId: number,
    accessKeyId?: number,
    options?: { batchSize?: number },
  ): Promise<{
    success: any[];
    errors: { row: number; error: string }[];
    inserted: { row: number; id: number }[];
    updated: { row: number; id: number }[];
  }> {
    const batchSize = options?.batchSize || 100;
    const success = [];
    const errors = [];
    const inserted = [];
    const updated = [];
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchPromises = batch.map(async (record, idx) => {
        const rowNum = record.__rowNum__ ?? i + idx + 2; // +2 for Excel row
        try {
          // Check if a record exists for this warehouse_id + assignment_date (immutable identifier)
          const existing = await this.warehouseEmployeesRepository.findOne({
            where: {
              warehouse_id: record.warehouse_id,
              assignment_date: record.assignment_date,
            },
          });
          let fullRec: any;
          if (existing) {
            // Remove __rowNum__ before update
            const { __rowNum__, ...updatePayload } = record;
            updatePayload.access_key_id =
              accessKeyId ?? record.access_key_id ?? null;
            const updatedRec = await this.update(
              existing.id,
              updatePayload,
              userId,
              true, // skipAuditTrail for bulk upload updates
            );
            fullRec = await this.findOne(existing.id);
            updated.push({ row: rowNum, id: updatedRec.id });
          } else {
            // Create new
            record.access_key_id = accessKeyId ?? record.access_key_id ?? null;
            const createdRec = await this.create(record, userId, true); // skipAuditTrail for bulk upload creates
            fullRec = await this.findOne(createdRec.id);
            inserted.push({ row: rowNum, id: createdRec.id });
          }
          // Attach __rowNum__ to the response object
          success.push({ ...fullRec, __rowNum__: rowNum });
        } catch (err) {
          errors.push({ row: rowNum, error: this.getErrorMessage(err) });
        }
      });
      await Promise.all(batchPromises); // Run batch in parallel
    }
    if (success.length > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("warehouse_employees", 0);
        await this.cacheInvalidationService.invalidateWarehouseEmployees();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }
    return { success, errors, inserted, updated };
  }
}
