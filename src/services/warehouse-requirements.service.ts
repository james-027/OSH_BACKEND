import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CommonUtilitiesService } from "./common-utilities.service";
import { RequirementRemindersService } from "./requirement-reminders.service";

import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { Warehouse } from "src/entities/Warehouse";
import { Requirement } from "src/entities/Requirement";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { CreateWarehouseRequirementDto } from "src/dto/CreateWarehouseRequirementDto";
import { UpdateWarehouseRequirementDto } from "src/dto/UpdateWarehouseRequirementDto";
import { ResponseMapperService } from "./response-mapper.service";
import { WarehouseRequirementDuesService } from "./warehouse-requirement-dues.service";
import { WarehouseRequirementStartsService } from "./warehouse-requirement-starts.service";
import { SyncLog } from "src/entities/syncLog";
import { count } from "console";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class WarehouseRequirementsService {
  constructor(
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    @InjectRepository(ReqTransactionHeader)
    private reqTransactionHeaderRepository: Repository<ReqTransactionHeader>,
    @InjectRepository(ReqTransactionDetail)
    private reqTransactionDetailRepository: Repository<ReqTransactionDetail>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private responseMapperService: ResponseMapperService,
    private warehouseRequirementDuesService: WarehouseRequirementDuesService,
    private warehouseRequirementStartsService: WarehouseRequirementStartsService,
    private requirementRemindersService: RequirementRemindersService,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  private getDataRepoRelations(): string[] {
    return [
      "status",
      "createdBy",
      "updatedBy",
      "warehouse",
      "warehouse.location",
      "warehouse.segment",
      "warehouse.warehouseType",
      "warehouse.remStatus",
      "requirement",
      "requirement.renewalType",
    ];
  }

  async findAll(accessKeyId?: number): Promise<any[]> {
    try {
      const where: any = {};
      if (accessKeyId) {
        where.access_key_id = accessKeyId;
      }
      const warehouseRequirements =
        await this.warehouseRequirementsRepository.find({
          relations: this.getDataRepoRelations(),
          where: Object.keys(where).length ? where : undefined,
        });

      return this.responseMapperService.mapEntitiesToResponse(
        warehouseRequirements
      );
    } catch (error) {
      console.error("Error fetching warehouse requirements:", error);
      throw new Error("Failed to fetch warehouse requirements");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id },
          relations: this.getDataRepoRelations(),
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${id} not found`
        );
      }

      return this.responseMapperService.mapEntityToResponse(
        warehouseRequirement
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching warehouse requirement:", error);
      throw new Error("Failed to fetch warehouse requirement");
    }
  }

  async create(
    createWarehouseRequirementDto: CreateWarehouseRequirementDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if combination already exists
      const existingWarehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: {
            warehouse_id: createWarehouseRequirementDto.warehouse_id,
            requirement_id: createWarehouseRequirementDto.requirement_id,
          },
        });

      if (existingWarehouseRequirement) {
        throw new BadRequestException(
          "This warehouse-requirement combination already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newWarehouseRequirement =
        this.warehouseRequirementsRepository.create({
          warehouse_id: createWarehouseRequirementDto.warehouse_id,
          requirement_id: createWarehouseRequirementDto.requirement_id,
          status_id: createWarehouseRequirementDto.status_id || 1,
          created_by: userId,
        });

      const savedWarehouseRequirement =
        await this.warehouseRequirementsRepository.save(
          newWarehouseRequirement
        );

      // Emit SSE event for warehouse requirement creation (broadcast to all users)
      try {
        const response = await this.findOne(savedWarehouseRequirement.id);
        this.sseEventEmitter.emitCreate(
          "warehouse_requirements",
          savedWarehouseRequirement.id,
          response
        );
      } catch (sseError) {
        logger.warn(
          "SSE event emission failed for warehouse requirement creation:",
          sseError
        );
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseRequirementsService",
          method: "create",
          raw_data: JSON.stringify(createWarehouseRequirementDto),
          description: `Created warehouse requirement ID: ${savedWarehouseRequirement.id}`,
          status_id: 1,
        },
        userId
      );

      return this.findOne(savedWarehouseRequirement.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error("Error creating warehouse requirement:", error);
      throw new Error("Failed to create warehouse requirement");
    }
  }

  async update(
    id: number,
    updateWarehouseRequirementDto: UpdateWarehouseRequirementDto,
    userId: number
  ): Promise<any> {
    try {
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id },
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${id} not found`
        );
      }

      // Check for duplicate if warehouse_id or requirement_id is being updated
      if (
        updateWarehouseRequirementDto.warehouse_id ||
        updateWarehouseRequirementDto.requirement_id
      ) {
        const checkWarehouseId =
          updateWarehouseRequirementDto.warehouse_id ||
          warehouseRequirement.warehouse_id;
        const checkRequirementId =
          updateWarehouseRequirementDto.requirement_id ||
          warehouseRequirement.requirement_id;

        const duplicateCheck =
          await this.warehouseRequirementsRepository.findOne({
            where: {
              warehouse_id: checkWarehouseId,
              requirement_id: checkRequirementId,
            },
          });

        if (duplicateCheck && duplicateCheck.id !== id) {
          throw new BadRequestException(
            "This warehouse-requirement combination already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(warehouseRequirement, {
        ...updateWarehouseRequirementDto,
        updated_by: userId,
      });

      const savedWarehouseRequirement =
        await this.warehouseRequirementsRepository.save(warehouseRequirement);

      // Emit SSE event for warehouse requirement update (broadcast to all users)
      try {
        const response = await this.findOne(savedWarehouseRequirement.id);
        this.sseEventEmitter.emitUpdate(
          "warehouse_requirements",
          id,
          response
        );
      } catch (sseError) {
        logger.warn(
          "SSE event emission failed for warehouse requirement update:",
          sseError
        );
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseRequirementsService",
          method: "update",
          raw_data: JSON.stringify(updateWarehouseRequirementDto),
          description: `Updated warehouse requirement ID: ${id}`,
          status_id: 1,
        },
        userId
      );

      return this.findOne(savedWarehouseRequirement.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error updating warehouse requirement:", error);
      throw new Error("Failed to update warehouse requirement");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id },
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${id} not found`
        );
      }

      const newStatusId = 2; // deactivate

      warehouseRequirement.status_id = newStatusId;
      warehouseRequirement.updated_by = userId;

      const saved =
        await this.warehouseRequirementsRepository.save(warehouseRequirement);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseRequirementsService",
          method: "toggleStatus",
          raw_data: JSON.stringify({ id, newStatusId }),
          description: `Toggled status for warehouse requirement ID: ${id} to status: ${newStatusId}`,
          status_id: 1,
        },
        userId
      );

      return this.findOne(saved.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error toggling warehouse requirement status:", error);
      throw new Error("Failed to toggle warehouse requirement status");
    }
  }

  /**
   * Scheduler method: Sync warehouse requirements based on warehouse rem_status_id
   * Runs every minute to check warehouses with rem_status_id of 8 or 9
   * and creates warehouse_requirements for all active requirements
   */
  async syncWarehouseRequirements(): Promise<{
    inserted: number;
    skipped: number;
    errors: string[];
    duesCreated: number;
    duesSkipped: number;
    startsCreated: number;
    startsSkipped: number;
  }> {
    const result = {
      inserted: 0,
      skipped: 0,
      errors: [] as string[],
      duesCreated: 0,
      duesSkipped: 0,
      startsCreated: 0,
      startsSkipped: 0,
    };

    try {
      // Fetch warehouses with rem_status_id of 8 or 9
      const targetWarehouses = await this.warehousesRepository.find({
        where: {
          rem_status_id: In([8, 9]),
        },
      });

      if (targetWarehouses.length === 0) {
        // Log summary success (nothing to do)
        try {
          await this.syncLogRepository.save({
            module: "WAREHOUSE REQUIREMENT",
            type: "success",
            action: "data insertion",
            message: "No target warehouses found for sync",
            row_data: JSON.stringify({ inserted: 0, skipped: 0 }),
          });
        } catch (logErr) {
          // ignore logging failures
        }

        return result;
      }

      // Fetch all active requirements (status_id = 1)
      const activeRequirements = await this.requirementsRepository.find({
        where: {
          status_id: 1,
        },
      });

      if (activeRequirements.length === 0) {
        // Log summary success (nothing to do)
        try {
          await this.syncLogRepository.save({
            module: "WAREHOUSE REQUIREMENT",
            type: "success",
            action: "data insertion",
            message: "No active requirements found for sync",
            row_data: JSON.stringify({ inserted: 0, skipped: 0 }),
          });
        } catch (logErr) {
          // ignore logging failures
        }

        return result;
      }

      // Get existing warehouse-requirement combinations
      const existingCombinations =
        await this.warehouseRequirementsRepository.find({
          select: ["warehouse_id", "requirement_id"],
        });

      const existingSet = new Set(
        existingCombinations.map(
          (wr) => `${wr.warehouse_id}-${wr.requirement_id}`
        )
      );

      // Build warehouse requirements to insert (after checking unique constraints)
      const wrsToInsert: WarehouseRequirement[] = [];
      const insertedWrIds: number[] = [];

      for (const warehouse of targetWarehouses) {
        for (const requirement of activeRequirements) {
          const combinationKey = `${warehouse.id}-${requirement.id}`;

          // Check if combination already exists
          if (existingSet.has(combinationKey)) {
            result.skipped++;
            continue;
          }

          // Add to batch
          const newWarehouseRequirement =
            this.warehouseRequirementsRepository.create({
              warehouse_id: warehouse.id,
              requirement_id: requirement.id,
              status_id: 1,
              access_key_id: warehouse.access_key_id,
              created_by: 1, // System user
            });

          wrsToInsert.push(newWarehouseRequirement);
        }
      }

      // Batch insert warehouse requirements in chunks
      const chunkSize = 1000;
      for (let i = 0; i < wrsToInsert.length; i += chunkSize) {
        const chunk = wrsToInsert.slice(i, i + chunkSize);
        try {
          const savedChunk =
            await this.warehouseRequirementsRepository.save(chunk);
          result.inserted += savedChunk.length;
          insertedWrIds.push(...savedChunk.map((wr) => wr.id));
        } catch (chunkError) {
          // Skip duplicate key errors silently
          if (
            chunkError.message &&
            chunkError.message.includes("Duplicate entry")
          ) {
            result.skipped += chunk.length;
          } else {
            result.errors.push(
              `Failed to batch insert warehouse requirements chunk: ${chunkError.message}`
            );
            // Log to sync_logs
            try {
              await this.syncLogRepository.save({
                module: "WAREHOUSE REQUIREMENT",
                type: "error",
                action: "data insertion",
                message: chunkError.message || String(chunkError),
                row_data: JSON.stringify({}),
              });
            } catch (logErr) {
              // ignore
            }
          }
        }
      }

      // Create dues and starts for newly inserted warehouse requirements
      if (insertedWrIds.length > 0) {
        try {
          const duesResult =
            await this.warehouseRequirementDuesService.createDuesForWarehouseRequirements(
              insertedWrIds,
              1000,
              1
            );
          result.duesCreated += duesResult.created;
          result.duesSkipped += duesResult.skipped;
          result.errors.push(...duesResult.errors);
        } catch (dueError) {
          result.errors.push(
            `Failed to create dues for inserted warehouse requirements: ${dueError.message}`
          );
        }

        try {
          const startsResult =
            await this.warehouseRequirementStartsService.createStartsForWarehouseRequirements(
              insertedWrIds,
              1000,
              1
            );
          result.startsCreated += startsResult.created;
          result.startsSkipped += startsResult.skipped;
          result.errors.push(...startsResult.errors);
        } catch (startError) {
          result.errors.push(
            `Failed to create starts for inserted warehouse requirements: ${startError.message}`
          );
        }
      }

      // Log summary success
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT",
          type: "success",
          action: "data insertion",
          message: "Sync completed",
          row_data: JSON.stringify({
            inserted: result.inserted,
            skipped: result.skipped,
            duesCreated: result.duesCreated,
            duesSkipped: result.duesSkipped,
            startsCreated: result.startsCreated,
            startsSkipped: result.startsSkipped,
            errors: result.errors.length,
          }),
        });
      } catch (logErr) {
        // ignore logging failure
      }

      return result;
    } catch (error) {
      // Log fatal sync error
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT",
          type: "error",
          action: "data insertion",
          message: error.message || String(error),
          row_data: JSON.stringify({}),
        });
      } catch (logErr) {
        // ignore
      }

      result.errors.push(`Sync failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get warehouses with base requirements and transacted requirements listing
   * Used to display warehouse overview with requirement counts and details
   */
  async getWarehouseRequirementsListing(
    warehouse_type_id: number,
    warehouse_id?: number,
    date_from?: string,
    date_to?: string,
    userId?: number,
    roleId?: number,
    accessKeyId?: number
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      let allowedLocationIds: number[] = [];
      if (userId && roleId) {
        allowedLocationIds =
          await this.commonUtilitiesService.getUserAllowedLocationIds(
            userId,
            roleId
          );
      }

      // Step 2: Build warehouse query conditions
      const warehouseWhere: any = {
        warehouse_type_id,
        rem_status_id: In([8, 9]),
      };

      if (warehouse_id) {
        warehouseWhere.id = warehouse_id;
      }

      if (accessKeyId !== undefined && accessKeyId !== null) {
        warehouseWhere.access_key_id = accessKeyId;
      }

      if (allowedLocationIds.length > 0) {
        warehouseWhere.location_id = In(allowedLocationIds);
      }

      // Step 3: Fetch warehouses with query builder for optimized date filtering on dues
      let query = this.warehousesRepository
        .createQueryBuilder("warehouse")
        .leftJoinAndSelect("warehouse.location", "location")
        .leftJoinAndSelect("warehouse.warehouseType", "warehouseType")
        .leftJoinAndSelect("warehouse.segment", "segment")
        .leftJoinAndSelect("warehouse.status", "status")
        .leftJoinAndSelect("warehouse.remStatus", "remStatus")
        .leftJoinAndSelect(
          "warehouse.warehouseRequirements",
          "warehouseRequirement"
        )
        .leftJoinAndSelect("warehouseRequirement.requirement", "requirement")
        .leftJoinAndSelect("warehouseRequirement.status", "requirementStatus")
        .leftJoinAndSelect(
          "warehouseRequirement.warehouseRequirementStarts",
          "warehouseRequirementStart"
        )
        .leftJoinAndSelect(
          "warehouseRequirement.warehouseRequirementDues",
          "warehouseRequirementDue"
        )
        .leftJoinAndSelect("requirement.renewalType", "renewalType");
      // Apply date filtering at database level if provided
      if (date_from && date_to) {
        const filterDateFrom = new Date(date_from);
        const filterDateTo = new Date(date_to);

        query = query.andWhere(
          `(
            warehouseRequirementDue.warehouse_requirement_due_start <= :filterDateTo
            AND warehouseRequirementDue.warehouse_requirement_due_end >= :filterDateFrom
          )`,
          { filterDateFrom, filterDateTo }
        );
      } else {
        // If no date filter, use subquery to get only the most recent due per requirement
        query = query.andWhere(
          `warehouseRequirementDue.id IN (
            SELECT MAX(id) FROM warehouse_requirement_dues 
            WHERE warehouse_requirement_id = warehouseRequirement.id
          )`
        );
      }

      // Apply warehouse where conditions
      query = query
        .andWhere("warehouse.warehouse_type_id = :warehouse_type_id", {
          warehouse_type_id,
        })
        .andWhere("warehouse.rem_status_id IN (:...remStatusIds)", {
          remStatusIds: [8, 9],
        });

      if (warehouse_id) {
        query = query.andWhere("warehouse.id = :warehouse_id", {
          warehouse_id,
        });
      }

      if (accessKeyId !== undefined && accessKeyId !== null) {
        query = query.andWhere("warehouse.access_key_id = :access_key_id", {
          access_key_id: accessKeyId,
        });
      }

      if (allowedLocationIds.length > 0) {
        query = query.andWhere(
          "warehouse.location_id IN (:...allowedLocationIds)",
          {
            allowedLocationIds,
          }
        );
      }

      const warehouses = await query
        .orderBy("warehouse.warehouse_name", "ASC")
        .addOrderBy("warehouseRequirementDue.id", "DESC")
        .getMany();

      if (warehouses.length === 0) {
        return {
          success: true,
          data: [],
          message: "No warehouses found matching the criteria",
        };
      }

      // Step 4: For each warehouse, process base requirements and transacted requirements
      const result = await Promise.all(
        warehouses.map(async (warehouse) => {
          // ========== BASE REQUIREMENTS WITH DETAILS ==========
          const baseRequirementsData =
            await this.getBaseRequirementsDetailsFromWarehouse(
              warehouse,
              date_from,
              date_to,
              false
            );

          // ========== TRANSACTED REQUIREMENTS WITH DETAILS ==========
          const transactedRequirementsData =
            await this.getTransactedRequirementsDetails(
              warehouse.id,
              date_from,
              date_to,
              false
            );

          return {
            id: warehouse.id,
            location_name: warehouse.location?.location_name || null,
            warehouse_name: warehouse.warehouse_name,
            warehouse_ifs: warehouse.warehouse_ifs,
            warehouse_code: warehouse.warehouse_code,
            warehouse_type_id: warehouse.warehouse_type_id,
            warehouse_type_name:
              warehouse.warehouseType?.warehouse_type_name || null,
            warehouse_rem_status_name: warehouse.remStatus?.status_name || null,
            baseRequirements: baseRequirementsData,
            transactedRequirements: transactedRequirementsData,
          };
        })
      );

      return {
        success: true,
        data: result,
        total: result.length,
      };
    } catch (error) {
      console.error("Error fetching warehouse requirements listing:", error);
      throw new BadRequestException(
        `Failed to fetch warehouse requirements: ${error.message}`
      );
    }
  }

  /**
   * Get base requirements details from warehouse entity
   * Uses eager-loaded dues already filtered by database query
   * Handles recurring requirements with multiple dues
   * Adds reminder status for each due based on due date
   */
  private async getBaseRequirementsDetailsFromWarehouse(
    warehouse: any,
    dateFrom?: string,
    dateTo?: string,
    countOnly: boolean = false,
    flatten: boolean = false
  ): Promise<any> {
    try {
      // Filter active base requirements (status_id = 1)
      const baseRequirements = (warehouse.warehouseRequirements || []).filter(
        (req) => req.status_id === 1
      );

      if (baseRequirements.length === 0) {
        return {
          count: 0,
          base_requirements_details: [],
        };
      }

      if (countOnly) {
        return {
          count: baseRequirements.length,
        };
      }

      // Process each requirement with its eager-loaded dues
      // (dues are already filtered by date at database level in optimized version)
      let baseRequirementsDetails = [];

      if (!flatten) {
        // Nested structure: requirements with nested dues array
        baseRequirementsDetails = await Promise.all(
          baseRequirements.map(async (baseReq) => {
            // Get the most recent warehouse requirement start
            const requirementStart = (baseReq.warehouseRequirementStarts ||
              [])[0];

            // Get warehouse requirement dues (already filtered by database query)
            const filteredDues = baseReq.warehouseRequirementDues || [];

            // Map dues to response structure with reminder status
            const warehouseRequirementDues = await Promise.all(
              filteredDues.map(async (due) => {
                // Get reminder status for this due
                const reminderStatus =
                  await this.requirementRemindersService.calculateDueRequirementReminderStatus(
                    baseReq.requirement_id,
                    due.warehouse_requirement_due_end
                  );

                return {
                  warehouse_requirement_due_start:
                    this.commonUtilitiesService.formatDateString(
                      due.warehouse_requirement_due_start
                    ),
                  warehouse_requirement_due_end:
                    this.commonUtilitiesService.formatDateString(
                      due.warehouse_requirement_due_end
                    ),
                  warehouse_requirement_due_id: due.id,
                  warehouse_requirement_due_status_id: due.status_id,
                  warehouse_requirement_due_status_name:
                    due.status_id === 1 ? "NOT FULFILLED" : "FULFILLED",
                  warehouse_requirement_due_reminder_name:
                    due.status_id === 1
                      ? reminderStatus?.reminderTypeName
                      : "-",
                  warehouse_requirement_due_reminder_days_diff:
                    reminderStatus?.daysDiff || null,
                };
              })
            );

            return {
              requirement_name: baseReq.requirement?.requirement_name || null,
              renewal_type_name:
                baseReq.requirement?.renewalType?.renewal_type_name || null,
              warehouse_requirement_start: requirementStart
                ? this.commonUtilitiesService.formatDateString(
                    requirementStart.warehouse_requirement_start
                  )
                : null,
              warehouse_requirement_dues: warehouseRequirementDues,
            };
          })
        );

        // Filter out requirements with no dues in the date range
        baseRequirementsDetails = baseRequirementsDetails.filter(
          (req) => req.warehouse_requirement_dues.length > 0
        );
      } else {
        // Flatten structure: one row per due with requirement info
        const flattenedDetails = [];

        for (const baseReq of baseRequirements) {
          const requirementStart = (baseReq.warehouseRequirementStarts ||
            [])[0];
          const filteredDues = baseReq.warehouseRequirementDues || [];

          for (const due of filteredDues) {
            // Get reminder status for this due
            const reminderStatus =
              await this.requirementRemindersService.calculateDueRequirementReminderStatus(
                baseReq.requirement_id,
                due.warehouse_requirement_due_end
              );

            flattenedDetails.push({
              requirement_name: baseReq.requirement?.requirement_name || null,
              renewal_type_name:
                baseReq.requirement?.renewalType?.renewal_type_name || null,
              warehouse_requirement_start: requirementStart
                ? this.commonUtilitiesService.formatDateString(
                    requirementStart.warehouse_requirement_start
                  )
                : null,
              warehouse_requirement_due_start:
                this.commonUtilitiesService.formatDateString(
                  due.warehouse_requirement_due_start
                ),
              warehouse_requirement_due_end:
                this.commonUtilitiesService.formatDateString(
                  due.warehouse_requirement_due_end
                ),
              warehouse_requirement_due_id: due.id,
              warehouse_requirement_due_status_id: due.status_id,
              warehouse_requirement_due_status_name:
                due.status_id === 1 ? "NOT FULFILLED" : "FULFILLED",
              warehouse_requirement_due_reminder_name:
                due.status_id === 1 ? reminderStatus?.reminderTypeName : "-",
              warehouse_requirement_due_reminder_days_diff:
                reminderStatus?.daysDiff || null,
            });
          }
        }

        baseRequirementsDetails = flattenedDetails;
      }

      return {
        count: baseRequirements.length,
        base_requirements_details: baseRequirementsDetails,
      };
    } catch (error) {
      console.error("Error processing base requirements details:", error);
      return {
        count: 0,
        base_requirements_details: [],
      };
    }
  }

  /**
   * Get transacted requirements details for a warehouse
   * Grouped by transaction header with nested details
   * Optimized: Uses eager loading with single query
   * Filters by transaction date falling within the provided date range
   */
  private async getTransactedRequirementsDetails(
    warehouseId: number,
    dateFrom?: string,
    dateTo?: string,
    countOnly: boolean = false,
    flatten: boolean = false
  ): Promise<any> {
    try {
      // Build where condition for transaction headers
      let headerWhere: any = {
        warehouse_id: warehouseId,
        status_id: 1,
      };

      // Apply date filtering if provided
      if (dateFrom && dateTo) {
        const dateRange = this.commonUtilitiesService.getDateRange(
          dateFrom,
          dateTo
        );
        headerWhere.trans_date = In(dateRange);
      }

      // Get transaction headers with eager loaded details in a single query
      const transactionHeaders = await this.reqTransactionHeaderRepository.find(
        {
          where: headerWhere,
          relations: [
            "requirement",
            "reqTransactionDetails",
            "requirement.renewalType",
            "reqTransactionDues",
          ],
          order: { id: "ASC" },
        }
      );

      if (transactionHeaders.length === 0) {
        return {
          count_hdr: 0,
          count_dtl: 0,
          trans_headers: [],
        };
      }

      // Filter and map details - only include active details (status_id=1)
      let totalDetailCount = 0;
      let transHeaders = [];
      if (!flatten) {
        transHeaders = transactionHeaders
          .map((header) => {
            // Filter active details for this header
            const activeDetails = (header.reqTransactionDetails || []).filter(
              (detail) => detail.status_id === 1
            );

            totalDetailCount += activeDetails.length;

            return {
              requirement_name: header.requirement?.requirement_name || null,
              trans_header_id: header.id,
              trans_remarks: header.trans_remarks || null,
              trans_due_status_name:
                header.trans_due_status_id === 1 ? "ON TIME" : "OVERDUE",
              trans_date: this.commonUtilitiesService.formatDateString(
                header.trans_date
              ),
              renewal_type_name:
                header.requirement?.renewalType?.renewal_type_name || null,
              req_transaction_due_id:
                header.reqTransactionDues &&
                header.reqTransactionDues.length > 0
                  ? header.reqTransactionDues[0].id
                  : null,
              trans_details: activeDetails.map((detail) => ({
                trans_detail_id: detail.id,
                requirement_file_path: detail.requirement_file_path || null,
                requirement_file_name:
                  this.commonUtilitiesService.formatTransFileName(
                    detail.requirement_file_name
                  ) || null,
              })),
            };
          })
          .filter((header) => header.trans_details.length > 0); // Only include headers with active details
      } else {
        // Flatten mode: return flattened list of details with header info
        const flattenedDetails = [];
        transactionHeaders.forEach((header) => {
          const activeDetails = (header.reqTransactionDetails || []).filter(
            (detail) => detail.status_id === 1
          );

          totalDetailCount += activeDetails.length;

          activeDetails.forEach((detail) => {
            flattenedDetails.push({
              requirement_name: header.requirement?.requirement_name || null,
              trans_header_id: header.id,
              trans_date: this.commonUtilitiesService.formatDateString(
                header.trans_date
              ),
              renewal_type_name:
                header.requirement?.renewalType?.renewal_type_name || null,
              trans_due_status_name:
                header.trans_due_status_id === 1 ? "ON TIME" : "OVERDUE",
              trans_detail_id: detail.id,
              requirement_file_path: detail.requirement_file_path || null,
              requirement_file_name:
                this.commonUtilitiesService.formatTransFileName(
                  detail.requirement_file_name
                ) || null,
            });
          });
        });

        transHeaders = flattenedDetails;
      }

      if (countOnly) {
        return {
          count_hdr: transHeaders.length,
          count_dtl: totalDetailCount,
        };
      }

      return {
        count_hdr: transHeaders.length,
        count_dtl: totalDetailCount,
        trans_headers: transHeaders,
      };
    } catch (error) {
      console.error("Error fetching transacted requirements details:", error);
      return {
        count_hdr: 0,
        count_dtl: 0,
        trans_headers: [],
      };
    }
  }

  /**
   * Reusable warehouse query builder with common filtering
   * Returns a query builder that can be extended with additional joins/conditions
   * Handles: warehouse_type_id, rem_status_id, warehouse_id, accessKeyId, allowedLocationIds
   */
  private buildBaseWarehouseQuery(
    warehouse_type_id: number,
    warehouse_id?: number,
    accessKeyId?: number,
    allowedLocationIds?: number[]
  ) {
    const query = this.warehousesRepository
      .createQueryBuilder("warehouse")
      .leftJoinAndSelect("warehouse.location", "location")
      .leftJoinAndSelect("warehouse.warehouseType", "warehouseType")
      .leftJoinAndSelect("warehouse.remStatus", "remStatus")
      .where("warehouse.warehouse_type_id = :warehouse_type_id", {
        warehouse_type_id,
      })
      .andWhere("warehouse.rem_status_id IN (:...remStatusIds)", {
        remStatusIds: [8, 9],
      });

    if (warehouse_id) {
      query.andWhere("warehouse.id = :warehouse_id", { warehouse_id });
    }

    if (accessKeyId !== undefined && accessKeyId !== null) {
      query.andWhere("warehouse.access_key_id = :access_key_id", {
        access_key_id: accessKeyId,
      });
    }

    if (allowedLocationIds && allowedLocationIds.length > 0) {
      query.andWhere("warehouse.location_id IN (:...allowedLocationIds)", {
        allowedLocationIds,
      });
    }

    return query;
  }

  /**
   * OPTIMIZED: Get warehouses with base requirements and transacted requirements listing
   * Uses two-query approach for better performance on large datasets
   * Query 1: Warehouses + Requirements + Starts (without dues)
   * Query 2: Dues separately with date filtering
   * Merge: Attach dues to requirements in-memory
   */
  async getWarehouseRequirementsListingOptimized(
    warehouse_type_id: number,
    warehouse_id?: number,
    date_from?: string,
    date_to?: string,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
    flatten: boolean = false
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      let allowedLocationIds: number[] = [];
      if (userId && roleId) {
        allowedLocationIds =
          await this.commonUtilitiesService.getUserAllowedLocationIds(
            userId,
            roleId
          );
      }

      // Step 2: Build and execute warehouse query
      const warehouseQuery = this.buildBaseWarehouseQuery(
        warehouse_type_id,
        warehouse_id,
        accessKeyId,
        allowedLocationIds
      );

      const warehouses = await warehouseQuery
        .orderBy("warehouse.warehouse_name", "ASC")
        .getMany();

      if (warehouses.length === 0) {
        return {
          success: true,
          data: [],
          message: "No warehouses found matching the criteria",
        };
      }

      // Step 3: Get warehouse requirements separately (with their data)
      const warehouseIds = warehouses.map((w) => w.id);
      const requirementsQuery = this.warehouseRequirementsRepository
        .createQueryBuilder("warehouseRequirement")
        .leftJoinAndSelect("warehouseRequirement.requirement", "requirement")
        .leftJoinAndSelect("requirement.renewalType", "renewalType")
        .leftJoinAndSelect("warehouseRequirement.status", "requirementStatus")
        .leftJoinAndSelect(
          "warehouseRequirement.warehouseRequirementStarts",
          "warehouseRequirementStart"
        )
        .where("warehouseRequirement.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        })
        .andWhere("warehouseRequirement.status_id = :status_id", {
          status_id: 1,
        });

      const requirements = await requirementsQuery.getMany();

      // Step 4: Attach requirements to warehouses (in-memory)
      const requirementsMap = new Map<number, any[]>();
      requirements.forEach((req) => {
        if (!requirementsMap.has(req.warehouse_id)) {
          requirementsMap.set(req.warehouse_id, []);
        }
        requirementsMap.get(req.warehouse_id).push(req);
      });

      warehouses.forEach((warehouse) => {
        warehouse.warehouseRequirements =
          requirementsMap.get(warehouse.id) || [];
      });

      // Step 5: Build list of requirement IDs from fetched requirements
      const warehouseRequirementIds: number[] = requirements.map((r) => r.id);

      // Step 6: Query dues separately with optimized date filtering
      let duesQuery = this.warehouseRequirementDuesService[
        "warehouseRequirementDuesRepository"
      ]
        .createQueryBuilder("warehouseRequirementDue")
        .andWhere(
          "warehouseRequirementDue.warehouse_requirement_id IN (:...warehouseRequirementIds)",
          { warehouseRequirementIds }
        );

      // Apply date filtering at database level
      if (date_from && date_to) {
        const filterDateFrom = new Date(date_from);
        const filterDateTo = new Date(date_to);

        duesQuery = duesQuery.andWhere(
          `(
            warehouseRequirementDue.warehouse_requirement_due_start <= :filterDateTo
            AND warehouseRequirementDue.warehouse_requirement_due_end >= :filterDateFrom
          )`,
          { filterDateFrom, filterDateTo }
        );
      } else {
        // If no date filter, get only the most recent due per requirement
        duesQuery = duesQuery.andWhere(
          `warehouseRequirementDue.id IN (
            SELECT MAX(id) FROM warehouse_requirement_dues 
            WHERE warehouse_requirement_id = warehouseRequirementDue.warehouse_requirement_id
          )`
        );
      }

      const warehouseRequirementDues = await duesQuery.getMany();

      // Step 7: Map dues back to requirements (in-memory merge)
      const duesMap = new Map<number, any[]>();
      warehouseRequirementDues.forEach((due) => {
        if (!duesMap.has(due.warehouse_requirement_id)) {
          duesMap.set(due.warehouse_requirement_id, []);
        }
        duesMap.get(due.warehouse_requirement_id).push(due);
      });

      // Attach dues to requirements
      warehouses.forEach((warehouse) => {
        (warehouse.warehouseRequirements || []).forEach((req) => {
          req.warehouseRequirementDues = duesMap.get(req.id) || [];
        });
      });

      // Step 8: Process base requirements and transacted requirements for each warehouse
      const result = await Promise.all(
        warehouses.map(async (warehouse) => {
          // Get base requirements with nested dues
          const baseRequirementsData =
            await this.getBaseRequirementsDetailsFromWarehouse(
              warehouse,
              date_from,
              date_to,
              false,
              flatten
            );

          // Get transacted requirements
          const transactedRequirementsData =
            await this.getTransactedRequirementsDetails(
              warehouse.id,
              date_from,
              date_to,
              false,
              flatten
            );

          return {
            id: warehouse.id,
            location_name: warehouse.location?.location_name || null,
            warehouse_name: warehouse.warehouse_name,
            warehouse_ifs: warehouse.warehouse_ifs,
            warehouse_code: warehouse.warehouse_code,
            warehouse_type_id: warehouse.warehouse_type_id,
            warehouse_type_name:
              warehouse.warehouseType?.warehouse_type_name || null,
            warehouse_rem_status_name: warehouse.remStatus?.status_name || null,
            baseRequirements: baseRequirementsData,
            transactedRequirements: transactedRequirementsData,
          };
        })
      );

      return {
        success: true,
        data: result,
        total: result.length,
      };
    } catch (error) {
      console.error(
        "Error fetching warehouse requirements listing (optimized):",
        error
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements: ${error.message}`
      );
    }
  }

  /**
   * Get warehouse requirements listing with COUNTS ONLY (ultra-fast)
   * Returns minimal data: warehouse info + requirement/transaction counts
   * Optimized for quick dashboard/list views
   */
  async getWarehouseRequirementsListingCounts(
    warehouse_type_id: number,
    warehouse_id?: number,
    date_from?: string,
    date_to?: string,
    userId?: number,
    roleId?: number,
    accessKeyId?: number
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      let allowedLocationIds: number[] = [];
      if (userId && roleId) {
        allowedLocationIds =
          await this.commonUtilitiesService.getUserAllowedLocationIds(
            userId,
            roleId
          );
      }

      // Step 2: Get warehouse list (minimal query, no nested relations)
      const warehouseQuery = this.buildBaseWarehouseQuery(
        warehouse_type_id,
        warehouse_id,
        accessKeyId,
        allowedLocationIds
      );

      const warehouses = await warehouseQuery
        .orderBy("warehouse.warehouse_name", "ASC")
        .getMany();

      if (warehouses.length === 0) {
        return {
          success: true,
          data: [],
          message: "No warehouses found matching the criteria",
        };
      }

      // Step 3: Get requirement counts per warehouse (filtered by due date range)
      const warehouseIds = warehouses.map((w) => w.id);
      let requirementCountsQuery = this.warehouseRequirementsRepository
        .createQueryBuilder("warehouseRequirement")
        .select("warehouseRequirement.warehouse_id", "warehouse_id")
        .addSelect(
          "COUNT(DISTINCT warehouseRequirement.id)",
          "requirement_count"
        )
        .leftJoin(
          "warehouseRequirement.warehouseRequirementDues",
          "warehouseRequirementDue"
        )
        .where("warehouseRequirement.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        });

      // Apply date filtering if provided
      if (date_from && date_to) {
        const filterDateFrom = new Date(date_from);
        const filterDateTo = new Date(date_to);

        requirementCountsQuery = requirementCountsQuery.andWhere(
          `(
            warehouseRequirementDue.warehouse_requirement_due_start <= :filterDateTo
            AND warehouseRequirementDue.warehouse_requirement_due_end >= :filterDateFrom
          )`,
          { filterDateFrom, filterDateTo }
        );
      } else {
        // Fallback: count all requirements with status_id = 1 or 2
        requirementCountsQuery = requirementCountsQuery.andWhere(
          "warehouseRequirement.status_id IN (:...requirementStatusIds)",
          { requirementStatusIds: [1, 2] }
        );
      }

      requirementCountsQuery = requirementCountsQuery.groupBy(
        "warehouseRequirement.warehouse_id"
      );

      const requirementCounts = await requirementCountsQuery.getRawMany();

      // Create map for fast lookup
      const requirementCountMap = new Map<number, number>();
      requirementCounts.forEach((rc) => {
        requirementCountMap.set(
          parseInt(rc.warehouse_id),
          parseInt(rc.requirement_count)
        );
      });

      // Step 4: Get transaction counts per warehouse
      const transactionHeaderCountsQuery = this.reqTransactionHeaderRepository
        .createQueryBuilder("reqTransactionHeader")
        .select("reqTransactionHeader.warehouse_id", "warehouse_id")
        .addSelect("COUNT(DISTINCT reqTransactionHeader.id)", "header_count")
        .addSelect("COUNT(reqTransactionDetail.id)", "detail_count")
        .leftJoin(
          "reqTransactionHeader.reqTransactionDetails",
          "reqTransactionDetail",
          "reqTransactionDetail.status_id = :detail_status_id"
        )
        .where("reqTransactionHeader.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        })
        .andWhere("reqTransactionHeader.status_id = :header_status_id", {
          header_status_id: 1,
        })
        .setParameter("detail_status_id", 1);

      // Apply date filtering if provided
      if (date_from && date_to) {
        const dateRange = this.commonUtilitiesService.getDateRange(
          date_from,
          date_to
        );
        transactionHeaderCountsQuery.andWhere(
          "reqTransactionHeader.trans_date IN (:...dateRange)",
          { dateRange }
        );
      }

      const transactionHeaderCounts = await transactionHeaderCountsQuery
        .groupBy("reqTransactionHeader.warehouse_id")
        .getRawMany();

      // Create map for fast lookup
      const transactionCountMap = new Map<number, any>();
      transactionHeaderCounts.forEach((tc) => {
        transactionCountMap.set(parseInt(tc.warehouse_id), {
          count_hdr: parseInt(tc.header_count) || 0,
          count_dtl: parseInt(tc.detail_count) || 0,
        });
      });

      // Step 5: Build response with counts only
      const result = warehouses.map((warehouse) => ({
        id: warehouse.id,
        location_name: warehouse.location?.location_name || null,
        warehouse_name: warehouse.warehouse_name,
        warehouse_ifs: warehouse.warehouse_ifs,
        warehouse_code: warehouse.warehouse_code,
        warehouse_type_id: warehouse.warehouse_type_id,
        warehouse_type_name:
          warehouse.warehouseType?.warehouse_type_name || null,
        warehouse_rem_status_name: warehouse.remStatus?.status_name || null,
        baseRequirements: {
          count: requirementCountMap.get(warehouse.id) || 0,
        },
        transactedRequirements: {
          count_hdr: transactionCountMap.get(warehouse.id)?.count_hdr || 0,
          count_dtl: transactionCountMap.get(warehouse.id)?.count_dtl || 0,
          trans_headers: [],
        },
      }));

      return result;

      // return {
      //   success: true,
      //   data: result,
      //   total: result.length,
      // };
    } catch (error) {
      console.error(
        "Error fetching warehouse requirements counts listing:",
        error
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements counts: ${error.message}`
      );
    }
  }
}
