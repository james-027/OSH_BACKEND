import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { WarehouseEmployee } from "../../../entities/WarehouseEmployee";
import { CreateWarehouseEmployeeDto } from "../dto/CreateWarehouseEmployeeDto";
import { UpdateWarehouseEmployeeDto } from "../dto/UpdateWarehouseEmployeeDto";
import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";
import { ActionLogsService } from "../../actions/services/action-logs.service";
import { Warehouse } from "src/entities/Warehouse";
import {
  parseToFirstDayOfMonth,
  formatDateToMonthYear,
} from "../../../utils/date.utils";
import {
  MODULE_IDS,
  ACTION_IDS,
  STATUS_IDS,
  STATUS_NAMES,
} from "src/constants/customConstants";
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
    private actionLogsService: ActionLogsService,
  ) {}

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  }

  /**
   * Map raw WarehouseEmployee entity to API response format
   * Extracts the mapping logic to avoid code duplication
   */
  private mapToResponse(rec: WarehouseEmployee): any {
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

  /**
   * Build human-readable personnel change description for action logs
   * Shows which roles changed with from/to employee names (or N/A for empty positions)
   * Format (newline-separated):
   * Updated Warehouse Name (Code) - Month Year:
   * SS: OldName → NewName
   * AH: OldName → NewName
   * ... (one per line)
   */
  private buildPersonnelChangeDescription(
    warehouse: { warehouse_name: string; warehouse_ifs: string },
    assignmentDate: string, // Format: "May 2026"
    oldAssignment: any, // Previous warehouse_employee record with relations (or null for create)
    newAssignment: any, // New/current warehouse_employee record with relations
    viaUpload: boolean = false, // Indicate if the change is from bulk upload
  ): string {
    const roles = ["SS", "AH", "BCH", "GBCH", "RH", "GRH"];
    const relationMap = {
      ss: "assignedSs",
      ah: "assignedAh",
      bch: "assignedBch",
      gbch: "assignedGbch",
      rh: "assignedRh",
      grh: "assignedGrh",
    };

    const changes = roles
      .map((role) => {
        const fieldName = `assigned_${role.toLowerCase()}`;
        const relationName = relationMap[role.toLowerCase()];

        // Get old employee name (from oldAssignment relation if exists)
        let oldValue = "N/A";
        if (oldAssignment?.[relationName]) {
          const oldEmployee = oldAssignment[relationName];
          oldValue =
            `${oldEmployee.employee_first_name} ${oldEmployee.employee_last_name}`.trim();
        }

        // Get new employee name (from newAssignment relation if exists)
        let newValue = "N/A";
        if (newAssignment?.[relationName]) {
          const newEmployee = newAssignment[relationName];
          newValue =
            `${newEmployee.employee_first_name} ${newEmployee.employee_last_name}`.trim();
        }

        // No change: show old value → [unchanged] (including N/A if empty)
        if (oldValue === newValue) {
          return `${role}: ${oldValue} → [unchanged]`;
        }

        // Changed: show old → new with employee names
        return `${role}: ${oldValue} → ${newValue}`;
      })
      .join(" | ");

    const prefixDesc = viaUpload ? `Updated via upload` : `Updated via form`;

    return `${prefixDesc} ${warehouse.warehouse_name} (${warehouse.warehouse_ifs}) - ${assignmentDate}: ${changes}`;
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
    query.orderBy("we.modified_at", "DESC").addOrderBy("we.id", "DESC");
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
      .andWhere("w.status_id = :statusId", { statusId: STATUS_IDS.ACTIVE })
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
    return this.mapToResponse(rec);
  }

  async create(
    createDto: CreateWarehouseEmployeeDto,
    userId: number,
    skipAuditTrail: boolean = false,
    skipActionLogs: boolean = false,
  ): Promise<WarehouseEmployee> {
    // Uniqueness check - warehouse_id + assignment_date must be unique
    const exists = await this.warehouseEmployeesRepository.findOne({
      where: {
        warehouse_id: createDto.warehouse_id,
        assignment_date: createDto.assignment_date,
      },
      relations: ["warehouse"],
    });
    if (exists) {
      throw new BadRequestException(
        `A record with this store (${exists.warehouse ? exists.warehouse.warehouse_name : exists.warehouse_id}) and assignment date (${createDto.assignment_date}) already exists.`,
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
            status_id: STATUS_IDS.ACTIVE,
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

      // Action Log - Log warehouse personnel assignment creation
      if (!skipActionLogs) {
        try {
          const warehouse = await this.warehousesRepository.findOne({
            where: { id: saved.warehouse_id },
          });
          const assignmentDateFormatted = formatDateToMonthYear(
            saved.assignment_date,
          );
          // Fetch with relations for informative description
          const savedWithRelations =
            await this.warehouseEmployeesRepository.findOne({
              where: { id: saved.id },
              relations: [
                "assignedSs",
                "assignedAh",
                "assignedBch",
                "assignedGbch",
                "assignedRh",
                "assignedGrh",
              ],
            });
          const description = this.buildPersonnelChangeDescription(
            warehouse || { warehouse_name: "Unknown", warehouse_ifs: "N/A" },
            assignmentDateFormatted,
            null, // No old assignment on create
            savedWithRelations,
          );
          await this.actionLogsService.logAction({
            module_id: MODULE_IDS.STORE_EMPLOYEES,
            ref_id: saved.id,
            action_id: ACTION_IDS.ADD,
            description,
            raw_data: JSON.stringify(createDto),
            created_by: userId,
          });
        } catch (err) {
          logger.error("Action log failed for create:", err);
          // Don't throw - action log failure shouldn't block creation
        }
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
    skipActionLogs: boolean = false,
  ): Promise<WarehouseEmployee> {
    // SINGLE OPTIMIZED FETCH: Get raw entity with ALL relations needed for entire method
    const recRaw = await this.warehouseEmployeesRepository.findOne({
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

    if (!recRaw) {
      throw new NotFoundException("Warehouse employee record not found");
    }

    // Map to response format for logic operations
    const rec = this.mapToResponse(recRaw);

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
        throw new BadRequestException(
          `A record with this warehouse and assignment date (${rec.assignment_date}) already exists.`,
        );
      }
    }

    // Store old assignment BEFORE update - use raw entity with loaded relations
    const oldAssignment = { ...recRaw };

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
            description: `Updated warehouse employee ID: ${id} - ${rec.warehouse_name || ""}`,
            status_id: STATUS_IDS.ACTIVE,
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

      // Action Log - Log personnel assignment changes
      if (!skipActionLogs) {
        try {
          // SECOND OPTIMIZED FETCH: Get updated entity with relations for action log
          const updatedRecRaw = await this.warehouseEmployeesRepository.findOne(
            {
              where: { id },
              relations: [
                "warehouse",
                "assignedSs",
                "assignedAh",
                "assignedBch",
                "assignedGbch",
                "assignedRh",
                "assignedGrh",
              ],
            },
          );

          if (updatedRecRaw) {
            const warehouse = updatedRecRaw.warehouse;
            const assignmentDateFormatted = formatDateToMonthYear(
              updatedRecRaw.assignment_date,
            );
            const description = this.buildPersonnelChangeDescription(
              warehouse || { warehouse_name: "Unknown", warehouse_ifs: "N/A" },
              assignmentDateFormatted,
              oldAssignment,
              updatedRecRaw,
            );
            await this.actionLogsService.logAction({
              module_id: MODULE_IDS.STORE_EMPLOYEES,
              ref_id: id,
              action_id: ACTION_IDS.EDIT,
              description,
              raw_data: JSON.stringify(updateDto),
              created_by: userId,
            });
          }
        } catch (err) {
          logger.error("Action log failed for update:", err);
          // Don't throw - action log failure shouldn't block update
        }
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
    // SINGLE FETCH with all needed relations
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
    if (!rec) {
      throw new NotFoundException(
        `Warehouse employee record with ID ${id} not found`,
      );
    }
    const newStatusId =
      rec.status_id === STATUS_IDS.ACTIVE
        ? STATUS_IDS.INACTIVE
        : STATUS_IDS.ACTIVE;
    const newStatusName = STATUS_NAMES[newStatusId] || "Unknown";
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
        status_id: STATUS_IDS.ACTIVE,
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

    // Action Log - Log status toggle (activation/deactivation)
    try {
      const warehouse = rec.warehouse;
      const assignmentDateFormatted = formatDateToMonthYear(
        rec.assignment_date,
      );
      const actionId =
        newStatusId === STATUS_IDS.ACTIVE
          ? ACTION_IDS.ACTIVATE
          : ACTION_IDS.DEACTIVATE;

      // Build detailed personnel list for description
      const personnelDetails = [
        rec.assignedSs
          ? `${rec.assignedSs.employee_first_name} ${rec.assignedSs.employee_last_name}`
          : null,
        rec.assignedAh
          ? `${rec.assignedAh.employee_first_name} ${rec.assignedAh.employee_last_name}`
          : null,
        rec.assignedBch
          ? `${rec.assignedBch.employee_first_name} ${rec.assignedBch.employee_last_name}`
          : null,
        rec.assignedGbch
          ? `${rec.assignedGbch.employee_first_name} ${rec.assignedGbch.employee_last_name}`
          : null,
        rec.assignedRh
          ? `${rec.assignedRh.employee_first_name} ${rec.assignedRh.employee_last_name}`
          : null,
        rec.assignedGrh
          ? `${rec.assignedGrh.employee_first_name} ${rec.assignedGrh.employee_last_name}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const description = `${newStatusName} personnel assignment for ${warehouse?.warehouse_name || "Unknown"} (${warehouse?.warehouse_code || "N/A"}) - ${assignmentDateFormatted}${personnelDetails ? ": " + personnelDetails : ""}`;

      await this.actionLogsService.logAction({
        module_id: MODULE_IDS.STORE_EMPLOYEES,
        ref_id: id,
        action_id: actionId,
        description,
        raw_data: JSON.stringify({
          id,
          prev_status_id: rec.status_id,
          new_status_id: newStatusId,
        }),
        created_by: userId,
      });
    } catch (err) {
      logger.error("Action log failed for toggleStatus:", err);
      // Don't throw - action log failure shouldn't block status toggle
    }

    // Return mapped response using existing data
    return this.mapToResponse(rec);
  }

  async findOneHistory(ref_id: number) {
    const module_id = MODULE_IDS.STORE_EMPLOYEES;
    return this.actionLogsService.findPerModuleRefID(module_id, ref_id);
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
    const actionLogs = []; // Collect action logs for batch insert

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
          let isInsert = false;
          let oldAssignment: any = null;
          let newAssignmentRaw: any = null;

          if (existing) {
            // FETCH OLD STATE BEFORE UPDATE (to capture previous personnel assignments)
            oldAssignment = await this.warehouseEmployeesRepository.findOne({
              where: { id: existing.id },
              relations: [
                "assignedSs",
                "assignedAh",
                "assignedBch",
                "assignedGbch",
                "assignedRh",
                "assignedGrh",
              ],
            });

            // Remove __rowNum__ before update
            const { __rowNum__, ...updatePayload } = record;
            updatePayload.access_key_id =
              accessKeyId ?? record.access_key_id ?? null;
            await this.update(
              existing.id,
              updatePayload,
              userId,
              true, // skipAuditTrail for bulk upload updates
              true, // skipActionLogs for bulk upload updates (batch insert later)
            );

            // FETCH UPDATED STATE ONCE - raw entity with relations
            newAssignmentRaw = await this.warehouseEmployeesRepository.findOne({
              where: { id: existing.id },
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

            // Map raw entity to response format
            fullRec = this.mapToResponse(newAssignmentRaw);
            updated.push({ row: rowNum, id: existing.id });
          } else {
            // Create new
            record.access_key_id = accessKeyId ?? record.access_key_id ?? null;
            const createdRec = await this.create(
              record,
              userId,
              true, // skipAuditTrail for bulk upload creates
              true, // skipActionLogs for bulk upload creates (batch insert later)
            );

            // FETCH CREATED STATE ONCE - raw entity with relations
            newAssignmentRaw = await this.warehouseEmployeesRepository.findOne({
              where: { id: createdRec.id },
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

            // Map raw entity to response format
            fullRec = this.mapToResponse(newAssignmentRaw);
            inserted.push({ row: rowNum, id: createdRec.id });
            isInsert = true;
          }

          // Collect action log for batch insert
          try {
            const warehouse = await this.warehousesRepository.findOne({
              where: { id: fullRec.warehouse_id },
            });
            const assignmentDateFormatted = formatDateToMonthYear(
              fullRec.assignment_date,
            );
            const actionId = isInsert ? ACTION_IDS.ADD : ACTION_IDS.EDIT;
            const description = this.buildPersonnelChangeDescription(
              warehouse || { warehouse_name: "Unknown", warehouse_ifs: "N/A" },
              assignmentDateFormatted,
              oldAssignment, // Use captured old assignment state (with relations)
              newAssignmentRaw, // Use raw entity with relations
              true, // Indicate this is from bulk upload for description formatting
            );
            actionLogs.push({
              module_id: MODULE_IDS.STORE_EMPLOYEES,
              ref_id: fullRec.id,
              action_id: actionId,
              description,
              raw_data: JSON.stringify(record),
              created_by: userId,
            });
          } catch (err) {
            logger.error("Failed to build action log for bulk record:", err);
            // Don't fail the bulk operation if action log prep fails
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

    // Batch insert all action logs (optimized DB roundtrip)
    if (actionLogs.length > 0) {
      try {
        await this.actionLogsService.logActionBatch(actionLogs);
      } catch (err) {
        logger.error("Failed to batch insert action logs:", err);
        // Don't throw - action log failure shouldn't block bulk operation
      }
    }

    return { success, errors, inserted, updated };
  }

  /**
   * Get warehouse assignment report - Flat listing of ALL warehouses with personnel assignments per month
   * Shows gaps (warehouses with missing assignments) by LEFT JOINing warehouse_employees
   * Even warehouses with NO assignment for a month will appear in results (NULL values)
   *
   * @param location_ids Optional comma-separated location IDs (defaults to user's allowed locations)
   * @param date_from Start date for assignment date range (YYYY-MM-DD format)
   * @param date_to End date for assignment date range (YYYY-MM-DD format)
   * @param userId User ID for access control
   * @param roleId User's role ID for access control
   * @param accessKeyId Optional access key filter
   * @returns Flat array of warehouse-month rows with personnel assignments
   */
  async getWarehouseAssignmentReport(
    location_ids?: number[],
    date_from?: string,
    date_to?: string,
    store_status_ids?: number[],
    status_id?: number,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
  ): Promise<any[]> {
    try {
      // Step 1: Parse location_ids if provided (comma-separated)
      let filterLocationIds: number[] = [];
      if (location_ids && location_ids.length > 0) {
        filterLocationIds = location_ids
          .map((id) => Number(id))
          .filter((id) => !isNaN(id));
      }

      // Step 2: Get allowed location IDs based on user and role
      let allowedLocationIds: number[] | undefined = undefined;
      if (userId && roleId) {
        allowedLocationIds =
          await this.commonUtilitiesService.getUserAllowedLocationIds(
            userId,
            roleId,
          );
      }

      // Step 3: Determine final location IDs to use
      let finalLocationIds = allowedLocationIds || [];
      if (filterLocationIds.length > 0) {
        // Intersect: only use location_ids that are also in allowed locations
        finalLocationIds = filterLocationIds.filter((id) =>
          allowedLocationIds?.includes(id),
        );
      }

      if (finalLocationIds.length === 0) {
        return [];
      }

      // Step 4: Build query - LEFT JOIN to show all warehouses even with no assignment
      let query = this.warehousesRepository
        .createQueryBuilder("w")
        .select([
          "w.id",
          "w.warehouse_ifs",
          "w.warehouse_name",
          "w.warehouse_code",
          "w.location_id",
          "l.location_name",
          "l.location_abbr",
          "we.id as assignment_id",
          "we.assignment_date",
          "we.assigned_ss",
          "we.assigned_ah",
          "we.assigned_bch",
          "we.assigned_gbch",
          "we.assigned_rh",
          "we.assigned_grh",
          "we.status_id as assignment_status_id",
        ])
        .leftJoinAndSelect("w.location", "l");

      // LEFT JOIN warehouse_employees with date filter in ON clause
      // Build join condition and accumulate parameters to avoid overwrites
      let joinCondition = "we.warehouse_id = w.id";
      const queryParams: any = { finalLocationIds };

      // Add status_id filter to join if provided
      if (status_id !== undefined && status_id !== null) {
        joinCondition += ` AND we.status_id = :status_id`;
        queryParams.status_id = status_id;
      }

      // Add date filter to join condition if provided
      if (date_from && date_to) {
        joinCondition += ` AND (we.assignment_date IS NULL OR (we.assignment_date >= :date_from AND we.assignment_date <= :date_to))`;
        queryParams.date_from = date_from;
        queryParams.date_to = date_to;
      }

      query = query
        .leftJoinAndSelect("warehouse_employees", "we", joinCondition)
        .where("w.location_id IN (:...finalLocationIds)");

      // Add warehouse status filter if provided (accumulate before setParameters)
      if (store_status_ids && store_status_ids.length > 0) {
        query = query.andWhere("w.rem_status_id IN (:...store_status_ids)");
        queryParams.store_status_ids = store_status_ids;
      }

      // Apply access_key_id filter if provided (accumulate before setParameters)
      if (accessKeyId !== undefined && accessKeyId !== null) {
        query = query.andWhere("w.access_key_id = :access_key_id");
        queryParams.access_key_id = accessKeyId;
      }

      // Set ALL parameters at once to avoid overwrites
      query = query.setParameters(queryParams);

      // Step 5: Execute query with sorting
      // Note: MySQL uses IS NOT NULL DESC to put NULLs last
      const results = await query
        .orderBy("w.warehouse_name", "ASC")
        .addOrderBy("we.assignment_date IS NOT NULL", "DESC")
        .addOrderBy("we.assignment_date", "ASC")
        .getRawMany();

      // Step 6: Map results to include personnel names (from assignment IDs if available)
      if (results.length === 0) {
        return [];
      }

      // Get all assignment IDs for bulk loading employee names
      const assignmentIds = results
        .filter((r) => r.assignment_id)
        .map((r) => r.assignment_id);

      let employeeNamesMap = new Map<number, any>();
      if (assignmentIds.length > 0) {
        const assignments = await this.warehouseEmployeesRepository.find({
          where: { id: In(assignmentIds) },
          relations: [
            "assignedSs",
            "assignedAh",
            "assignedBch",
            "assignedGbch",
            "assignedRh",
            "assignedGrh",
          ],
        });

        assignments.forEach((assignment) => {
          employeeNamesMap.set(assignment.id, {
            assigned_ss_name: assignment.assignedSs
              ? `${assignment.assignedSs.employee_first_name} ${assignment.assignedSs.employee_last_name}`
              : null,
            assigned_ss_employee_number: assignment.assignedSs
              ? assignment.assignedSs.employee_number
              : null,
            assigned_ah_name: assignment.assignedAh
              ? `${assignment.assignedAh.employee_first_name} ${assignment.assignedAh.employee_last_name}`
              : null,
            assigned_ah_employee_number: assignment.assignedAh
              ? assignment.assignedAh.employee_number
              : null,
            assigned_bch_name: assignment.assignedBch
              ? `${assignment.assignedBch.employee_first_name} ${assignment.assignedBch.employee_last_name}`
              : null,
            assigned_bch_employee_number: assignment.assignedBch
              ? assignment.assignedBch.employee_number
              : null,
            assigned_gbch_name: assignment.assignedGbch
              ? `${assignment.assignedGbch.employee_first_name} ${assignment.assignedGbch.employee_last_name}`
              : null,
            assigned_gbch_employee_number: assignment.assignedGbch
              ? assignment.assignedGbch.employee_number
              : null,
            assigned_rh_name: assignment.assignedRh
              ? `${assignment.assignedRh.employee_first_name} ${assignment.assignedRh.employee_last_name}`
              : null,
            assigned_rh_employee_number: assignment.assignedRh
              ? assignment.assignedRh.employee_number
              : null,
            assigned_grh_name: assignment.assignedGrh
              ? `${assignment.assignedGrh.employee_first_name} ${assignment.assignedGrh.employee_last_name}`
              : null,
            assigned_grh_employee_number: assignment.assignedGrh
              ? assignment.assignedGrh.employee_number
              : null,
          });
        });
      }

      // Step 7: Build final report rows with grouped personnel structure
      const roleOrder = ["SS", "AH", "BCH", "GBCH", "RH", "GRH"];
      const report = results.map((row) => {
        const employeeNames = employeeNamesMap.get(row.assignment_id) || {};

        // Build personnel object grouped by role
        const personnel: Record<string, any> = {
          SS: {
            id: row.we_assigned_ss,
            name: employeeNames.assigned_ss_name,
            emp_number: employeeNames.assigned_ss_employee_number,
          },
          AH: {
            id: row.we_assigned_ah,
            name: employeeNames.assigned_ah_name,
            emp_number: employeeNames.assigned_ah_employee_number,
          },
          BCH: {
            id: row.we_assigned_bch,
            name: employeeNames.assigned_bch_name,
            emp_number: employeeNames.assigned_bch_employee_number,
          },
          GBCH: {
            id: row.we_assigned_gbch,
            name: employeeNames.assigned_gbch_name,
            emp_number: employeeNames.assigned_gbch_employee_number,
          },
          RH: {
            id: row.we_assigned_rh,
            name: employeeNames.assigned_rh_name,
            emp_number: employeeNames.assigned_rh_employee_number,
          },
          GRH: {
            id: row.we_assigned_grh,
            name: employeeNames.assigned_grh_name,
            emp_number: employeeNames.assigned_grh_employee_number,
          },
        };

        return {
          warehouse_id: row.w_id,
          warehouse_ifs: row.w_warehouse_ifs,
          warehouse_name: row.w_warehouse_name,
          warehouse_code: row.w_warehouse_code,
          location_id: row.w_location_id,
          location_name: row.l_location_name,
          location_abbr: row.l_location_abbr,
          assignment_date: row.we_assignment_date
            ? dayjs(row.we_assignment_date).format("MMMM YYYY")
            : null,
          role_order: roleOrder,
          personnel,
          assignment_status_id: row.assignment_status_id,
          has_assignment: row.assignment_status_id === STATUS_IDS.ACTIVE,
        };
      });

      return report;
    } catch (error) {
      logger.error("Error fetching warehouse assignment report:", error);
      throw new BadRequestException(
        `Failed to fetch warehouse assignment report: ${this.getErrorMessage(error)}`,
      );
    }
  }
}
