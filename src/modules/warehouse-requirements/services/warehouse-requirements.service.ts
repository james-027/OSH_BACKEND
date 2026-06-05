import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Between, LessThanOrEqual } from "typeorm";

import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { RequirementRemindersService } from "../../requirements/services/requirement-reminders.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { Warehouse } from "src/entities/Warehouse";
import { Requirement } from "src/entities/Requirement";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { CreateWarehouseRequirementDto } from "src/modules/warehouse-requirements/dto/CreateWarehouseRequirementDto";
import { UpdateWarehouseRequirementDto } from "src/modules/warehouse-requirements/dto/UpdateWarehouseRequirementDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { WarehouseRequirementDuesService } from "./warehouse-requirement-dues.service";
import { WarehouseRequirementStartsService } from "./warehouse-requirement-starts.service";
import { SyncLog } from "src/entities/syncLog";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import {
  endOfLocalRange,
  formatDateToString,
  getCurrentUTCTimestamp,
  getLocalISOTimestamp,
  getUTCTimestamp,
  startOfLocalDay,
  toLocalDateObject,
} from "src/utils/date.utils";

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
    private cacheInvalidationService: CacheInvalidationService,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    private sseEventEmitter: SSEEventEmitterHelper,
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

  /**
   * Get allowed location IDs based on user and role
   * Reusable helper to avoid redundant code across multiple methods
   */
  private async getAllowedLocationIds(
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

  /**
   * Build date range filter condition for transaction headers
   * Returns trans_date IN array format for use in queries
   */
  private buildTransactionDateRangeParams(
    dateFrom?: string,
    dateTo?: string,
  ): { dateRange?: string[]; filterDateFrom?: Date; filterDateTo?: Date } {
    if (!dateFrom || !dateTo) {
      return {};
    }

    const dateRange = this.commonUtilitiesService.getDateRange(
      dateFrom,
      dateTo,
    );
    return { dateRange };
  }

  /**
   * Build base transaction query for requirement counting
   * Handles warehouse_ids, requirement_id, and status filters
   */
  private buildTransactionCountQuery(
    warehouseIds: number[],
    requirementId: number,
    headerStatusId: number = 1,
    detailStatusId: number = 1,
  ) {
    return this.reqTransactionHeaderRepository
      .createQueryBuilder("rth")
      .select("DISTINCT(rth.warehouse_id)", "warehouse_id")
      .where("rth.warehouse_id IN (:...warehouseIds)", { warehouseIds })
      .andWhere("rth.requirement_id = :requirement_id", {
        requirement_id: requirementId,
      })
      .andWhere("rth.status_id = :header_status_id", {
        header_status_id: headerStatusId,
      })
      .leftJoin("rth.reqTransactionDetails", "rtd")
      .andWhere("rtd.status_id = :detail_status_id", {
        detail_status_id: detailStatusId,
      });
  }

  /**
   * Group warehouses by location
   * Returns a Map<locationId, warehouses[]> sorted by location name
   */
  private groupWarehousesByLocation(warehouses: any[]): Map<number, any[]> {
    const warehousesByLocation = new Map<number, any[]>();

    warehouses.forEach((wh) => {
      if (!warehousesByLocation.has(wh.location_id)) {
        warehousesByLocation.set(wh.location_id, []);
      }
      warehousesByLocation.get(wh.location_id)!.push(wh);
    });

    return warehousesByLocation;
  }

  /**
   * Fetch warehouse requirements and dues with in-memory merging
   * Reusable helper to fetch warehouse data, requirements, and dues for given warehouse IDs
   * Returns { warehouses, requirements, duesMap, warehouseRequirementIds }
   */
  private async fetchWarehouseRequirementsAndDues(
    warehouseIds: number[],
    dateFrom?: string,
    dateTo?: string,
    requirementTypeId?: number,
  ): Promise<{
    requirements: any[];
    duesMap: Map<number, any[]>;
    warehouseRequirementIds: number[];
  }> {
    // Query warehouse requirements
    let requirementsQuery = this.warehouseRequirementsRepository
      .createQueryBuilder("warehouseRequirement")
      .leftJoinAndSelect("warehouseRequirement.requirement", "requirement")
      .leftJoinAndSelect("requirement.renewalType", "renewalType")
      .leftJoinAndSelect("warehouseRequirement.status", "requirementStatus")
      .leftJoinAndSelect(
        "warehouseRequirement.warehouseRequirementStarts",
        "warehouseRequirementStart",
      )
      .where("warehouseRequirement.warehouse_id IN (:...warehouseIds)", {
        warehouseIds,
      })
      .andWhere("warehouseRequirement.status_id IN (:...status_id)", {
        status_id: [1, 18], // ADDITIONAL TERMINATED STATUS
      });

    if (requirementTypeId) {
      requirementsQuery = requirementsQuery.andWhere(
        "requirement.requirement_type_id = :requirementTypeId",
        {
          requirementTypeId,
        },
      );
    }

    const requirements = await requirementsQuery.getMany();
    const warehouseRequirementIds: number[] = requirements.map((r) => r.id);

    // If no requirements found, return empty result
    if (warehouseRequirementIds.length === 0) {
      return {
        requirements: [],
        duesMap: new Map(),
        warehouseRequirementIds: [],
      };
    }

    // Query dues separately with date filtering
    let duesQuery = this.warehouseRequirementDuesService[
      "warehouseRequirementDuesRepository"
    ]
      .createQueryBuilder("warehouseRequirementDue")
      .where(
        "warehouseRequirementDue.warehouse_requirement_id IN (:...warehouseRequirementIds)",
        { warehouseRequirementIds },
      );

    // Apply date filtering at database level
    if (dateFrom && dateTo) {
      const filterDateFrom = new Date(dateFrom);
      const filterDateTo = new Date(dateTo);

      duesQuery = duesQuery.andWhere(
        `(
          warehouseRequirementDue.warehouse_requirement_due_start >= :filterDateFrom
          AND warehouseRequirementDue.warehouse_requirement_due_start <= :filterDateTo
        )`,
        {
          filterDateFrom:
            this.commonUtilitiesService.formatDateString(filterDateFrom),
          filterDateTo:
            this.commonUtilitiesService.formatDateString(filterDateTo),
        },
      );
    } else {
      // If no date filter, get only the most recent due per requirement
      duesQuery = duesQuery.andWhere(
        `warehouseRequirementDue.id IN (
          SELECT MAX(wrd.id) FROM warehouse_requirement_dues wrd
          WHERE wrd.warehouse_requirement_id = warehouseRequirementDue.warehouse_requirement_id
          GROUP BY wrd.warehouse_requirement_id
        )`,
      );
    }

    const warehouseRequirementDues = await duesQuery.getMany();

    // Map dues by warehouse_requirement_id
    const duesMap = new Map<number, any[]>();
    warehouseRequirementDues.forEach((due) => {
      if (!duesMap.has(due.warehouse_requirement_id)) {
        duesMap.set(due.warehouse_requirement_id, []);
      }
      duesMap.get(due.warehouse_requirement_id).push(due);
    });

    return { requirements, duesMap, warehouseRequirementIds };
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
        warehouseRequirements,
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
          `Warehouse requirement with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(
        warehouseRequirement,
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
    userId: number,
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
          "This warehouse-requirement combination already exists",
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
          newWarehouseRequirement,
        );

      // Emit SSE event for warehouse requirement creation (broadcast to all users)
      try {
        const response = await this.findOne(savedWarehouseRequirement.id);
        this.sseEventEmitter.emitCreate(
          "warehouse_requirements",
          savedWarehouseRequirement.id,
          response,
        );

        // Clear warehouse requirements caches (DRY: SSE + cache invalidation)
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
      } catch (sseError) {
        logger.warn(
          "SSE event emission failed for warehouse requirement creation:",
          sseError,
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
        userId,
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
    userId: number,
  ): Promise<any> {
    try {
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id },
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${id} not found`,
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
            "This warehouse-requirement combination already exists",
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
        this.sseEventEmitter.emitUpdate("warehouse_requirements", id, response);

        // Clear warehouse requirements caches (DRY: SSE + cache invalidation)
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
      } catch (sseError) {
        logger.warn(
          "SSE event emission failed for warehouse requirement update:",
          sseError,
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
        userId,
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
          `Warehouse requirement with ID ${id} not found`,
        );
      }

      const newStatusId = 2; // deactivate

      warehouseRequirement.status_id = newStatusId;
      warehouseRequirement.updated_by = userId;

      const saved =
        await this.warehouseRequirementsRepository.save(warehouseRequirement);

      // Clear warehouse requirements caches (DRY: SSE + cache invalidation)
      await this.cacheInvalidationService.invalidateWarehouseRequirements();

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseRequirementsService",
          method: "toggleStatus",
          raw_data: JSON.stringify({ id, newStatusId }),
          description: `Toggled status for warehouse requirement ID: ${id} to status: ${newStatusId}`,
          status_id: 1,
        },
        userId,
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
  async syncWarehouseRequirements(year: number = 2025): Promise<{
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
      const activeRequirements = await this.activeRequirements(1);

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
          (wr) => `${wr.warehouse_id}-${wr.requirement_id}`,
        ),
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
          const chunkErr = chunkError as Error;
          if (
            chunkErr.message &&
            chunkErr.message.includes("Duplicate entry")
          ) {
            result.skipped += chunk.length;
          } else {
            result.errors.push(
              `Failed to batch insert warehouse requirements chunk: ${chunkErr.message}`,
            );
            // Log to sync_logs
            try {
              await this.syncLogRepository.save({
                module: "WAREHOUSE REQUIREMENT",
                type: "error",
                action: "data insertion",
                message: chunkErr.message || String(chunkError),
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
              year,
              1000,
              1,
            );
          result.duesCreated += duesResult.created;
          result.duesSkipped += duesResult.skipped;
          result.errors.push(...duesResult.errors);
        } catch (dueError) {
          const dueErr = dueError as Error;
          result.errors.push(
            `Failed to create dues for inserted warehouse requirements: ${dueErr.message}`,
          );
        }

        try {
          const startsResult =
            await this.warehouseRequirementStartsService.createStartsForWarehouseRequirements(
              insertedWrIds,
              year,
              1000,
              1,
            );
          result.startsCreated += startsResult.created;
          result.startsSkipped += startsResult.skipped;
          result.errors.push(...startsResult.errors);
        } catch (startError) {
          const startErr = startError as Error;
          result.errors.push(
            `Failed to create starts for inserted warehouse requirements: ${startErr.message}`,
          );
        }
      }

      if (result.inserted > 0 || result.errors.length > 0) {
        // Log summary
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
      }

      if (result.inserted > 0) {
        // SSE Events
        try {
          this.sseEventEmitter.emitCreateSignal("req_transactions", 0);
          this.sseEventEmitter.emitCreateSignal("warehouses", 0);
          await this.cacheInvalidationService.invalidateWarehouseRequirements();
          await this.cacheInvalidationService.invalidateWarehouses();
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      return result;
    } catch (error) {
      // Log fatal sync error
      const err = error as Error;
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT",
          type: "error",
          action: "data insertion",
          message: err.message || String(error),
          row_data: JSON.stringify({}),
        });
      } catch (logErr) {
        // ignore
      }

      result.errors.push(`Sync failed: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Create warehouse requirement dues for all recurring requirements (non-ONE TIME)
   * Triggered manually via POST endpoint when needed
   * Expects warehouse_requirements and warehouse_requirement_starts already exist
   * Filters out ONE TIME (renewal_type_id = 1) at DATABASE LEVEL for optimal performance
   * Checks for existing combination of (warehouse_requirement_id, due_start, due_end) before insertion
   */
  async syncWarehouseRequirementsPeriodically(
    year: number = new Date().getFullYear(),
    userId: number = 1,
  ): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    const result = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    logger.info("Starting warehouse requirements periodic sync...");

    try {
      // Query for active warehouse requirements with recurring requirements (renewal_type_id !== 1)
      // Filter at database level for optimal performance
      const recurringRequirementIds = await this.warehouseRequirementsRepository
        .createQueryBuilder("wr")
        .select("wr.id", "id")
        .innerJoinAndSelect("wr.requirement", "requirement")
        .where("wr.status_id = :status_id", { status_id: 1 })
        .andWhere("requirement.renewal_type_id != :renewal_type_id", {
          renewal_type_id: 1,
        })
        .getRawMany();

      if (recurringRequirementIds.length === 0) {
        return result;
      }

      // Extract IDs from query results
      const wrIds = recurringRequirementIds.map((r) => r.id);

      // Call the existing createDuesForWarehouseRequirements method
      // It handles date calculations, unique constraint checking, and batch insertion
      const duesResult =
        await this.warehouseRequirementDuesService.createDuesForWarehouseRequirements(
          wrIds,
          year,
          1000, // chunkSize
          userId,
        );

      // Map results
      result.created = duesResult.created;
      result.skipped = duesResult.skipped;
      result.errors = duesResult.errors;

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehouseRequirementsService",
          method: "syncWarehouseRequirementsPeriodically",
          raw_data: JSON.stringify({
            year,
            recurringRequirementCount: wrIds.length,
          }),
          description: `Created warehouse requirement dues for ${result.created} requirements, skipped ${result.skipped} (year: ${year})`,
          status_id: 1,
        },
        userId,
      );

      logger.info(
        `Periodic sync completed: created ${result.created} dues, skipped ${result.skipped}, errors: ${result.errors.length}`,
      );

      // Log summary to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE (PERIODIC)",
          type: "success",
          action: "data insertion",
          message: `Created ${result.created} dues, skipped ${result.skipped}`,
          row_data: JSON.stringify({
            year,
            created: result.created,
            skipped: result.skipped,
            errors: result.errors.length,
          }),
        });
      } catch (logErr) {
        // ignore logging failure
      }

      if (result.created > 0) {
        // SSE Events
        try {
          this.sseEventEmitter.emitCreateSignal("req_transactions", 0);
          this.sseEventEmitter.emitCreateSignal("warehouses", 0);
          await this.cacheInvalidationService.invalidateWarehouseRequirements();
          await this.cacheInvalidationService.invalidateWarehouses();
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Periodic sync failed: ${(error as Error).message}`);

      // Log fatal sync error
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE (PERIODIC)",
          type: "error",
          action: "data insertion",
          message: (error as Error).message || String(error),
          row_data: JSON.stringify({ year: year }),
        });
      } catch (logErr) {
        // ignore logging failure
      }

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
    accessKeyId?: number,
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

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
          "warehouseRequirement",
        )
        .leftJoinAndSelect("warehouseRequirement.requirement", "requirement")
        .leftJoinAndSelect("warehouseRequirement.status", "requirementStatus")
        .leftJoinAndSelect(
          "warehouseRequirement.warehouseRequirementStarts",
          "warehouseRequirementStart",
        )
        .leftJoinAndSelect(
          "warehouseRequirement.warehouseRequirementDues",
          "warehouseRequirementDue",
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
          { filterDateFrom, filterDateTo },
        );
      } else {
        // If no date filter, use subquery to get only the most recent due per requirement
        query = query.andWhere(
          `warehouseRequirementDue.id IN (
            SELECT MAX(id) FROM warehouse_requirement_dues 
            WHERE warehouse_requirement_id = warehouseRequirement.id
          )`,
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
          },
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
              false,
            );

          // ========== TRANSACTED REQUIREMENTS WITH DETAILS ==========
          const transactedRequirementsData =
            await this.getTransactedRequirementsDetails(
              warehouse.id,
              date_from,
              date_to,
              false,
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
        }),
      );

      return {
        success: true,
        data: result,
        total: result.length,
      };
    } catch (error) {
      console.error("Error fetching warehouse requirements listing:", error);
      throw new BadRequestException(
        `Failed to fetch warehouse requirements: ${(error as Error).message}`,
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
    flatten: boolean = false,
    requirementTypeId: number = 1,
  ): Promise<any> {
    try {
      // Filter active base requirements (status_id = 1)
      const baseRequirements = (warehouse.warehouseRequirements || []).filter(
        (req) => req.status_id === 1 || req.status_id === 18, // ADDITIONAL TERMINATED STATUS
      );

      if (baseRequirements.length === 0) {
        return {
          count: 0,
          base_requirement_with_dues_count: 0,
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
      let totalDuesCount = 0; // Track additional dues count during processing

      if (!flatten) {
        // Nested structure: requirements with nested dues array
        baseRequirementsDetails = await Promise.all(
          baseRequirements.map(async (baseReq) => {
            // Get the most recent warehouse requirement start
            const requirementStart = (baseReq.warehouseRequirementStarts ||
              [])[0];

            // Get warehouse requirement dues (already filtered by database query)
            const filteredDues = baseReq.warehouseRequirementDues || [];

            // Accumulate additional dues count (dues beyond the first per requirement)
            const duesCount = filteredDues.length;
            if (duesCount > 1) {
              totalDuesCount += duesCount - 1;
            }

            // Map dues to response structure with reminder status
            const warehouseRequirementDues = await Promise.all(
              filteredDues.map(async (due) => {
                // Get reminder status for this due
                const reminderStatus =
                  await this.requirementRemindersService.calculateDueRequirementReminderStatus(
                    baseReq.requirement_id,
                    due.warehouse_requirement_due_date,
                  );

                return {
                  warehouse_requirement_due_start:
                    this.commonUtilitiesService.formatDateString(
                      due.warehouse_requirement_due_start,
                    ),
                  warehouse_requirement_due_end:
                    this.commonUtilitiesService.formatDateString(
                      due.warehouse_requirement_due_end,
                    ),
                  warehouse_requirement_due_date:
                    this.commonUtilitiesService.formatDateString(
                      due.warehouse_requirement_due_date,
                    ),
                  warehouse_requirement_due_id: due.id,
                  warehouse_requirement_due_status_id: due.status_id,
                  warehouse_requirement_due_status_name:
                    this.getWarehouseRequirementDueStatus(
                      requirementTypeId,
                      due.warehouse_requirement_due_date,
                      due.warehouse_requirement_due_end,
                      due.status_id,
                    ),
                  warehouse_requirement_due_reminder_name:
                    due.status_id === 1
                      ? reminderStatus?.reminderTypeName
                      : "-",
                  warehouse_requirement_due_reminder_days_diff:
                    reminderStatus?.daysDiff || null,
                };
              }),
            );

            return {
              requirement_name: baseReq.requirement?.requirement_name || null,
              renewal_type_name:
                baseReq.requirement?.renewalType?.renewal_type_name || null,
              warehouse_requirement_id: baseReq.id,
              warehouse_requirement_start: requirementStart
                ? this.commonUtilitiesService.formatDateString(
                    requirementStart.warehouse_requirement_start,
                  )
                : null,
              warehouse_requirement_dues: warehouseRequirementDues,
            };
          }),
        );

        // Filter out requirements with no dues in the date range
        baseRequirementsDetails = baseRequirementsDetails.filter(
          (req) => req.warehouse_requirement_dues.length > 0,
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
                due.warehouse_requirement_due_date,
              );

            flattenedDetails.push({
              requirement_name: baseReq.requirement?.requirement_name || null,
              renewal_type_name:
                baseReq.requirement?.renewalType?.renewal_type_name || null,
              warehouse_requirement_id: baseReq.id,
              warehouse_requirement_start: requirementStart
                ? this.commonUtilitiesService.formatDateString(
                    requirementStart.warehouse_requirement_start,
                  )
                : null,
              warehouse_requirement_due_start:
                this.commonUtilitiesService.formatDateString(
                  due.warehouse_requirement_due_start,
                ),
              warehouse_requirement_due_end:
                this.commonUtilitiesService.formatDateString(
                  due.warehouse_requirement_due_end,
                ),
              warehouse_requirement_due_date:
                this.commonUtilitiesService.formatDateString(
                  due.warehouse_requirement_due_date,
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

        // Calculate count: unique requirements with at least one due + additional dues
        const uniqueRequirementIds = new Set(
          flattenedDetails.map((d) => d.warehouse_requirement_id),
        );
        const uniqueRequirementCount = uniqueRequirementIds.size;
        const totalDuesInFlattened = flattenedDetails.length;
        totalDuesCount = totalDuesInFlattened - uniqueRequirementCount;
      }

      const baseRequirementWithDuesCount =
        (flatten
          ? new Set(
              baseRequirementsDetails.map((d) => d.warehouse_requirement_id),
            ).size + totalDuesCount
          : baseRequirementsDetails.length + totalDuesCount) || 0;

      return {
        count: flatten
          ? new Set(
              baseRequirementsDetails.map((d) => d.warehouse_requirement_id),
            ).size
          : baseRequirementsDetails.length,
        due_count: baseRequirementsDetails.length,
        base_requirement_with_dues_count: baseRequirementWithDuesCount,
        base_requirements_details: baseRequirementsDetails,
      };
    } catch (error) {
      console.error("Error processing base requirements details:", error);
      return {
        count: 0,
        base_requirement_with_dues_count: 0,
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
    flatten: boolean = false,
    requirementTypeId?: number,
  ): Promise<any> {
    try {
      // Build where condition for transaction headers
      let headerWhere: any = {
        warehouse_id: warehouseId,
        status_id: In([1, 18]), // ADDITIONAL TERMINATED STATUS
      };

      // Apply date filtering if provided
      if (dateFrom && dateTo) {
        const dateRange = this.commonUtilitiesService.getDateRange(
          dateFrom,
          dateTo,
        );
        headerWhere.trans_date = In(dateRange);
      }

      if (requirementTypeId) {
        headerWhere.requirement = { requirement_type_id: requirementTypeId };
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
            "reqTransactionDues.warehouseRequirementDue",
            "createdBy",
          ],
          order: { id: "ASC" },
        },
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
              (detail) => detail.status_id === 1 || detail.status_id === 18, // ADDITIONAL TERMINATED STATUS
            );

            totalDetailCount += activeDetails.length;

            return {
              requirement_name: header.requirement?.requirement_name || null,
              trans_header_id: header.id,
              trans_header_status_id: header.status_id,
              created_user: header.createdBy
                ? `${header.createdBy.first_name} ${header.createdBy.last_name}`
                : null,
              created_at: header.created_at,
              trans_remarks: header.trans_remarks || null,
              trans_due_status_name:
                header.trans_due_status_id === 1 ? "ON TIME" : "OVERDUE",
              trans_date: this.commonUtilitiesService.formatDateString(
                header.trans_date,
              ),
              renewal_type_name:
                header.requirement?.renewalType?.renewal_type_name || null,
              req_transaction_due_id:
                header.reqTransactionDues &&
                header.reqTransactionDues.length > 0
                  ? header.reqTransactionDues[0].id
                  : null,
              warehouse_requirement_due_status_name:
                header.reqTransactionDues &&
                header.reqTransactionDues.length > 0 &&
                header.reqTransactionDues[0].warehouseRequirementDue
                  ? this.getWarehouseRequirementDueStatus(
                      requirementTypeId,
                      header.reqTransactionDues[0].warehouseRequirementDue
                        .warehouse_requirement_due_date,
                      header.reqTransactionDues[0].warehouseRequirementDue
                        .warehouse_requirement_due_end,
                      header.reqTransactionDues[0].warehouseRequirementDue
                        .status_id,
                    )
                  : null,
              warehouse_requirement_due_date:
                this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_date,
                ),
              warehouse_requirement_due_start:
                this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_start,
                ),
              warehouse_requirement_due_end:
                this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_end,
                ),
              trans_details: activeDetails.map((detail) => ({
                trans_detail_id: detail.id,
                requirement_file_path: detail.requirement_file_path || null,
                requirement_file_name:
                  this.commonUtilitiesService.formatTransFileName(
                    detail.requirement_file_name,
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
            (detail) => detail.status_id === 1 || detail.status_id === 18, // ADDITIONAL TERMINATED STATUS
          );

          totalDetailCount += activeDetails.length;

          activeDetails.forEach((detail) => {
            flattenedDetails.push({
              requirement_name: header.requirement?.requirement_name || null,
              trans_header_id: header.id,
              trans_date: this.commonUtilitiesService.formatDateString(
                header.trans_date,
              ),
              renewal_type_name:
                header.requirement?.renewalType?.renewal_type_name || null,
              trans_due_status_name:
                header.trans_due_status_id === 1 ? "ON TIME" : "OVERDUE",
              trans_detail_id: detail.id,
              requirement_file_path: detail.requirement_file_path || null,
              requirement_file_name:
                this.commonUtilitiesService.formatTransFileName(
                  detail.requirement_file_name,
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
   * Calculate average and minimum due ages from collected daysUntilEnd values
   * Filters and aggregates due age calculations
   * @param dueAgesArray Array of daysUntilEnd values (days until expiration)
   * @param excludeExpired If true, skip expired items (daysUntilEnd <= 0)
   * @returns Object with ave_due_age and min_due_age (null if no valid items)
   */
  private calculateDueAges(
    dueAgesArray: number[],
    excludeExpired: boolean = false,
  ): { ave_due_age: number | null; min_due_age: number | null } {
    // Filter array if needed - only include positive values if excludeExpired is true
    const filteredAges = excludeExpired
      ? dueAgesArray.filter((age) => age > 0)
      : dueAgesArray;

    return {
      ave_due_age:
        filteredAges.length > 0
          ? Math.round(
              filteredAges.reduce((sum, age) => sum + age, 0) /
                filteredAges.length,
            )
          : null,
      min_due_age: filteredAges.length > 0 ? Math.min(...filteredAges) : null,
    };
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
    allowedLocationIds?: number[],
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
    requirementTypeId?: number,
    flatten: boolean = false,
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );
      // const allowedLocationIds = [1];

      // Step 2: Build and execute warehouse query
      const warehouseQuery = this.buildBaseWarehouseQuery(
        warehouse_type_id,
        warehouse_id,
        accessKeyId,
        allowedLocationIds,
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

      // Step 3: Get warehouse requirements and dues (using reusable helper)
      const warehouseIds = warehouses.map((w) => w.id);
      const { requirements, duesMap, warehouseRequirementIds } =
        await this.fetchWarehouseRequirementsAndDues(
          warehouseIds,
          date_from,
          date_to,
          requirementTypeId,
        );

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

      // Step 5: Attach dues to requirements
      warehouses.forEach((warehouse) => {
        (warehouse.warehouseRequirements || []).forEach((req) => {
          req.warehouseRequirementDues = duesMap.get(req.id) || [];
        });
      });

      // Step 6: Process base requirements and transacted requirements for each warehouse
      const result = await Promise.all(
        warehouses.map(async (warehouse) => {
          // Get base requirements with nested dues
          const baseRequirementsData =
            await this.getBaseRequirementsDetailsFromWarehouse(
              warehouse,
              date_from,
              date_to,
              false,
              flatten,
              requirementTypeId,
            );

          // Get transacted requirements
          const transactedRequirementsData =
            await this.getTransactedRequirementsDetails(
              warehouse.id,
              date_from,
              date_to,
              false,
              flatten,
              requirementTypeId,
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
        }),
      );

      return {
        success: true,
        data: result,
        total: result.length,
      };
    } catch (error) {
      console.error(
        "Error fetching warehouse requirements listing (optimized):",
        error,
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get warehouse requirements listing with COUNTS ONLY (ultra-fast)
   * Returns minimal data: warehouse info + requirement/transaction counts
   * Optimized for quick dashboard/list views
   *
   * @param baseRequirementsFilter Filter warehouses by base requirements count:
   *   - 'all': Show all warehouses (default)
   *   - 'withRequirements': Only warehouses with baseRequirements.count > 0
   *   - 'withoutRequirements': Only warehouses with baseRequirements.count = 0
   */
  async getWarehouseRequirementsListingCounts(
    warehouse_type_id: number,
    warehouse_id?: number,
    date_from?: string,
    date_to?: string,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
    requirementTypeId?: number,
    baseRequirementsFilter:
      | "all"
      | "withRequirements"
      | "withoutRequirements" = "all",
  ): Promise<any> {
    try {
      // Step 1: Get allowed location IDs based on user and role
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

      // Step 2: Get warehouse list (minimal query, no nested relations)
      const warehouseQuery = this.buildBaseWarehouseQuery(
        warehouse_type_id,
        warehouse_id,
        accessKeyId,
        allowedLocationIds,
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
          "requirement_count",
        )
        .leftJoin(
          "warehouseRequirement.warehouseRequirementDues",
          "warehouseRequirementDue",
        )
        .leftJoin("warehouseRequirement.requirement", "requirement")
        .where("warehouseRequirement.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        })
        .andWhere(
          "warehouseRequirement.status_id IN (:...requirementStatusIds)",
          {
            requirementStatusIds: [1, 2, 18], // ADDITIONAL TERMINATED STATUS
          },
        );

      // Apply date filtering if provided
      if (date_from && date_to) {
        const filterDateFrom = new Date(date_from);
        const filterDateTo = new Date(date_to);

        requirementCountsQuery = requirementCountsQuery.andWhere(
          `(
            warehouseRequirementDue.warehouse_requirement_due_start >= :filterDateFrom
            AND warehouseRequirementDue.warehouse_requirement_due_start <= :filterDateTo
          )`,
          {
            filterDateFrom:
              this.commonUtilitiesService.formatDateString(filterDateFrom),
            filterDateTo:
              this.commonUtilitiesService.formatDateString(filterDateTo),
          },
        );
      } else {
        // Fallback: count all requirements with status_id = 1 or 2
        requirementCountsQuery = requirementCountsQuery.andWhere(
          "warehouseRequirement.status_id IN (:...requirementStatusIds)",
          { requirementStatusIds: [1, 2, 18] }, // ADDITIONAL TERMINATED STATUS
        );
      }

      if (requirementTypeId) {
        requirementCountsQuery = requirementCountsQuery.andWhere(
          "requirement.requirement_type_id = :requirementTypeId",
          { requirementTypeId },
        );
      }

      requirementCountsQuery = requirementCountsQuery.groupBy(
        "warehouseRequirement.warehouse_id",
      );

      const requirementCounts = await requirementCountsQuery.getRawMany();

      // Create map for fast lookup
      const requirementCountMap = new Map<number, number>();
      requirementCounts.forEach((rc) => {
        requirementCountMap.set(
          parseInt(rc.warehouse_id),
          parseInt(rc.requirement_count),
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
          "reqTransactionDetail.status_id IN (:...detail_status_id)",
        )
        .leftJoin("reqTransactionHeader.requirement", "requirement")
        .where("reqTransactionHeader.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        })
        .andWhere("reqTransactionHeader.status_id IN (:...header_status_id)", {
          header_status_id: [1, 18], // ADDITIONAL TERMINATED STATUS
        })
        .setParameter("detail_status_id", [1, 18]); // ADDITIONAL TERMINATED STATUS

      // Apply date filtering if provided
      if (date_from && date_to) {
        const dateRange = this.commonUtilitiesService.getDateRange(
          date_from,
          date_to,
        );
        transactionHeaderCountsQuery.andWhere(
          "reqTransactionHeader.trans_date IN (:...dateRange)",
          { dateRange },
        );
      }

      if (requirementTypeId) {
        transactionHeaderCountsQuery.andWhere(
          "requirement.requirement_type_id = :requirementTypeId",
          { requirementTypeId },
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
      let result = warehouses.map((warehouse) => ({
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

      // Step 6: Apply baseRequirements filter
      if (baseRequirementsFilter === "withRequirements") {
        // Only include warehouses with baseRequirements.count > 0
        result = result.filter(
          (warehouse) => warehouse.baseRequirements.count > 0,
        );
      } else if (baseRequirementsFilter === "withoutRequirements") {
        // Only include warehouses with baseRequirements.count = 0
        result = result.filter(
          (warehouse) => warehouse.baseRequirements.count === 0,
        );
      }
      // If 'all', return all warehouses (no filtering)

      return result;
    } catch (error) {
      console.error(
        "Error fetching warehouse requirements counts listing:",
        error,
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements counts: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get warehouse requirements report grouped by location
   * Shows count of warehouses per location that have each requirement
   * Dynamic columns based on active requirements (status_id = 1)
   *
   * For requirementTypeId = 1: Shows single column per requirement (actual_no + %)
   * For requirementTypeId = 2: Shows 3 columns per requirement (ACTIVE, DUE FOR RENEWAL, EXPIRED) with due_age
   */
  async getWarehouseRequirementsListingPerLocation(
    warehouse_type_id: number,
    location_ids?: string,
    date_from?: string,
    date_to?: string,
    status_id?: number,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
    warehouse_rem_status_id?: number[],
    requirementTypeId?: number,
  ): Promise<any[]> {
    try {
      const activeRequirements =
        await this.activeRequirements(requirementTypeId);

      if (activeRequirements.length === 0) {
        return [];
      }

      // Step 2: Parse location_ids if provided (comma-separated)
      let filterLocationIds: number[] = [];
      if (location_ids) {
        filterLocationIds = location_ids
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));
      }

      // Step 3: Get allowed location IDs based on user and role
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

      // Step 4: Determine final location IDs to use
      let finalLocationIds =
        filterLocationIds.length > 0 ? filterLocationIds : allowedLocationIds;

      // const start_date = date_from ? startOfLocalDay(date_from) : null;
      const end_date = date_to ? endOfLocalRange(date_to) : null;
      const warehouses = await this.getWarehouses(
        warehouse_type_id,
        warehouse_rem_status_id,
        date_to,
        accessKeyId,
        finalLocationIds,
      );

      if (warehouses.length === 0) {
        return [];
      }

      // Step 6: Group warehouses by location
      const warehousesByLocation = this.groupWarehousesByLocation(warehouses);

      // Step 7: Build report rows per location
      const result: any[] = [];
      const today = formatDateToString(new Date());
      const todayDate = new Date(today);

      // For requirementTypeId = 2: Fetch ALL transaction data upfront (per location) with warehouse_requirement_dues
      let allTransactionsByLocation: Map<
        number,
        Map<number, any[]>
      > = new Map();

      if (requirementTypeId === 2) {
        for (const [locationId, locationWarehouses] of Array.from(
          warehousesByLocation.entries(),
        )) {
          const warehouseIds = locationWarehouses.map((w) => w.id);

          // Single query per location: fetch ALL transactions for requirementTypeId=2 with warehouse_requirement_dues
          let transactionQuery = this.reqTransactionHeaderRepository
            .createQueryBuilder("rth")
            .leftJoinAndSelect("rth.requirement", "requirement")
            .leftJoinAndSelect("rth.reqTransactionDues", "rtd")
            .leftJoinAndSelect("rtd.warehouseRequirementDue", "wrd")
            .where("rth.warehouse_id IN (:...warehouseIds)", {
              warehouseIds,
            })
            .andWhere("rth.status_id = :header_status_id", {
              header_status_id: status_id || 1,
            })
            .andWhere("requirement.requirement_type_id = :requirementTypeId", {
              requirementTypeId,
            });

          // Apply transaction date filtering if provided
          if (date_from && date_to) {
            const filterDateFrom = formatDateToString(new Date(date_from));
            const filterDateTo = formatDateToString(new Date(date_to));
            transactionQuery = transactionQuery.andWhere(
              "rth.trans_date >= :filterDateFrom AND rth.trans_date <= :filterDateTo",
              { filterDateFrom, filterDateTo },
            );
          }

          const transactionHeaders = await transactionQuery
            .orderBy("rth.id", "ASC")
            .getMany();

          // Index by requirement_id for fast lookup
          const byRequirement = new Map<number, any[]>();
          transactionHeaders.forEach((header) => {
            if (!byRequirement.has(header.requirement_id)) {
              byRequirement.set(header.requirement_id, []);
            }
            byRequirement.get(header.requirement_id).push(header);
          });

          allTransactionsByLocation.set(locationId, byRequirement);
        }
      }

      for (const [locationId, locationWarehouses] of Array.from(
        warehousesByLocation.entries(),
      ).sort((a, b) => {
        const nameA = a[1][0].location.location_name || "";
        const nameB = b[1][0].location.location_name || "";
        return nameA.localeCompare(nameB);
      })) {
        const location = locationWarehouses[0].location;
        const totalStores = locationWarehouses.length;
        const warehouseIds = locationWarehouses.map((w) => w.id);

        const row: any = {
          location_name: location.location_name,
          location_abbr: location.location_abbr,
          no_of_stores: totalStores,
          requirements: {},
        };

        // Step 8: For each active requirement, count warehouses in this location that have TRANSACTED that requirement
        for (const requirement of activeRequirements) {
          if (requirementTypeId === 2) {
            // NEW FORMAT: Process in-memory from pre-fetched data
            const transactionsByReq =
              allTransactionsByLocation.get(locationId) || new Map();
            const transactionsForReq =
              transactionsByReq.get(requirement.id) || [];

            // Categorize transactions by status and collect daysUntilEnd values
            const activeWarehouses = new Set<number>();
            const dueWarehouses = new Set<number>();
            const expiredWarehouses = new Set<number>();
            const terminatedWarehouses = new Set<number>();
            const dueAges: number[] = [];

            transactionsForReq.forEach((header) => {
              // Get warehouse_requirement_dues for this transaction
              const dues = header.reqTransactionDues || [];
              dues.forEach((due: any) => {
                const wrd = due.warehouseRequirementDue;
                if (!wrd) return;

                // ✅ NEW: Check for TERMINATED status (status_id = 18)
                if (wrd.status_id === 18) {
                  terminatedWarehouses.add(header.warehouse_id);
                  return; // Skip all date-based categorization for terminated
                }

                const dueDate = new Date(wrd.warehouse_requirement_due_date);
                const dueEndDate = new Date(wrd.warehouse_requirement_due_end);

                // Categorize based on dates
                if (dueDate > todayDate) {
                  // ACTIVE
                  activeWarehouses.add(header.warehouse_id);
                } else if (dueDate <= todayDate && dueEndDate > todayDate) {
                  // DUE FOR RENEWAL
                  dueWarehouses.add(header.warehouse_id);
                }

                if (dueEndDate <= todayDate) {
                  // EXPIRED
                  expiredWarehouses.add(header.warehouse_id);
                }

                // Collect all daysUntilEnd values (including negative/expired)
                const daysUntilEnd = Math.floor(
                  (dueEndDate.getTime() - todayDate.getTime()) /
                    (1000 * 60 * 60 * 24),
                );
                dueAges.push(daysUntilEnd);
              });
            });

            const activeCount = activeWarehouses.size;
            const dueCount = dueWarehouses.size;
            const expiredCount = expiredWarehouses.size;
            const terminatedCount = terminatedWarehouses.size;

            // Calculate average and minimum due_age using reusable method (excludeExpired=true)
            const dueAgeResult = this.calculateDueAges(dueAges, true);
            const avgDueAge = dueAgeResult.ave_due_age;
            const minDueAge = dueAgeResult.min_due_age;

            row.requirements[requirement.requirement_name] = {
              active: {
                actual_no: activeCount,
                percentage:
                  totalStores > 0
                    ? Math.round((activeCount / totalStores) * 100)
                    : 0,
              },
              due_for_renewal: {
                actual_no: dueCount,
                percentage:
                  totalStores > 0
                    ? Math.round((dueCount / totalStores) * 100)
                    : 0,
              },
              expired: {
                actual_no: expiredCount,
                percentage:
                  totalStores > 0
                    ? Math.round((expiredCount / totalStores) * 100)
                    : 0,
              },
              terminated: {
                actual_no: terminatedCount,
                percentage:
                  totalStores > 0
                    ? Math.round((terminatedCount / totalStores) * 100)
                    : 0,
              },
              ave_due_age: avgDueAge,
              min_due_age: minDueAge,
            };
          } else {
            // ORIGINAL FORMAT (requirementTypeId = 1): Single column per requirement
            let transactionQuery = this.buildTransactionCountQuery(
              warehouseIds,
              requirement.id,
              status_id || 1,
              status_id || 1,
            );

            // Apply date filtering on transaction date if provided
            if (date_from && date_to) {
              const filterDateFrom = formatDateToString(new Date(date_from));
              const filterDateTo = formatDateToString(new Date(date_to));

              transactionQuery = transactionQuery.andWhere(
                "rth.trans_date >= :filterDateFrom AND rth.trans_date <= :filterDateTo",
                { filterDateFrom, filterDateTo },
              );
            }

            const results = await transactionQuery.getRawMany();
            const requirementCount = results.length;
            const percentage =
              totalStores > 0
                ? Math.round((requirementCount / totalStores) * 100)
                : 0;

            row.requirements[requirement.requirement_name] = {
              actual_no: requirementCount,
              percentage: percentage,
            };
          }
        }

        result.push(row);
      }

      return result;
    } catch (error) {
      logger.error(
        "Error fetching warehouse requirements listing per location:",
        error,
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements per location: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get warehouse requirements detailed report - grouped by warehouse with warehouse_requirement_dues
   * Shows detailed per-warehouse requirements with transacted requirement counts and drill-down data
   * Groups requirements by requirement name with transaction details including warehouse_requirement_dues data
   * location_ids: Optional comma-separated location IDs (defaults to user's allowed locations)
   *
   * @param baseRequirementsFilter Filter warehouses by base requirements count:
   *   - 'all': Show all warehouses (default)
   *   - 'withRequirements': Only warehouses with baseRequirements count > 0
   *   - 'withoutRequirements': Only warehouses with baseRequirements count = 0
   */
  async getWarehouseRequirementsListingDetailedPerStore(
    warehouse_type_id: number,
    location_ids?: string,
    date_from?: string,
    date_to?: string,
    status_id?: number,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
    flatten: boolean = false,
    requirementTypeId?: number,
    baseRequirementsFilter:
      | "all"
      | "withRequirements"
      | "withoutRequirements" = "all",
    warehouse_rem_status_id?: number[],
  ): Promise<any> {
    try {
      // Step 1: Get active requirements only (status_id = 1)
      const activeRequirements =
        await this.activeRequirements(requirementTypeId);

      if (activeRequirements.length === 0) {
        return {
          success: true,
          data: [],
          message: "No active requirements found",
        };
      }

      // Step 2: Parse location_ids if provided (comma-separated)
      let filterLocationIds: number[] = [];
      if (location_ids) {
        filterLocationIds = location_ids
          .split(",")
          .map((id) => parseInt(id.trim(), 10))
          .filter((id) => !isNaN(id));
      }

      // Step 3: Get allowed location IDs based on user and role
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

      // Step 4: Determine final location IDs to use
      let finalLocationIds =
        filterLocationIds.length > 0 ? filterLocationIds : allowedLocationIds;

      const end_date = date_to ? endOfLocalRange(date_to) : null;
      // Step 5: Build warehouse query
      const warehouses = await this.getWarehouses(
        warehouse_type_id,
        warehouse_rem_status_id,
        date_to,
        accessKeyId,
        finalLocationIds,
        { warehouse_name: "ASC" },
        ["location", "warehouseType", "remStatus"],
      );

      if (warehouses.length === 0) {
        return {
          success: true,
          data: [],
          message: "No warehouses found matching the criteria",
        };
      }

      // Step 6: Get warehouse requirements and dues (using reusable helper)
      const warehouseIds = warehouses.map((w) => w.id);
      const { requirements: warehouseRequirements, duesMap } =
        await this.fetchWarehouseRequirementsAndDues(
          warehouseIds,
          date_from,
          date_to,
          requirementTypeId,
        );

      // Attach requirements to warehouses (in-memory)
      const requirementsMap = new Map<number, any[]>();
      warehouseRequirements.forEach((req) => {
        if (!requirementsMap.has(req.warehouse_id)) {
          requirementsMap.set(req.warehouse_id, []);
        }
        requirementsMap.get(req.warehouse_id).push(req);
      });

      warehouses.forEach((warehouse) => {
        warehouse.warehouseRequirements =
          requirementsMap.get(warehouse.id) || [];
      });

      // Attach dues to requirements
      warehouses.forEach((warehouse) => {
        (warehouse.warehouseRequirements || []).forEach((req) => {
          req.warehouseRequirementDues = duesMap.get(req.id) || [];
        });
      });

      // Step 7: Fetch transacted requirements with warehouse_requirement_dues data
      let transactionHeadersQuery = this.reqTransactionHeaderRepository
        .createQueryBuilder("rth")
        .leftJoinAndSelect("rth.requirement", "requirement")
        .leftJoinAndSelect("requirement.renewalType", "renewalType")
        .leftJoinAndSelect("rth.reqTransactionDetails", "rtd")
        .leftJoinAndSelect("rth.reqTransactionDues", "rtd_dues")
        .leftJoinAndSelect("rth.createdBy", "createdBy")
        .leftJoinAndSelect(
          "rtd_dues.warehouseRequirementDue",
          "warehouseRequirementDue",
        )
        .where("rth.warehouse_id IN (:...warehouseIds)", {
          warehouseIds,
        })
        .andWhere("rth.status_id = :header_status_id", {
          header_status_id: status_id || 1,
        });

      // Apply date filtering on transaction date
      if (date_from && date_to) {
        const dateRange = this.buildTransactionDateRangeParams(
          date_from,
          date_to,
        );
        if (dateRange.dateRange) {
          transactionHeadersQuery = transactionHeadersQuery.andWhere(
            "rth.trans_date IN (:...dateRange)",
            { dateRange: dateRange.dateRange },
          );
        }
      }

      const transactionHeaders = await transactionHeadersQuery
        .orderBy("rth.id", "ASC")
        .getMany();

      // Step 8: Build map of transactions by warehouse and requirement name
      const transactionsByWarehouseAndReq = new Map<
        number,
        Map<string, any[]>
      >();

      transactionHeaders.forEach((header) => {
        if (!transactionsByWarehouseAndReq.has(header.warehouse_id)) {
          transactionsByWarehouseAndReq.set(
            header.warehouse_id,
            new Map<string, any[]>(),
          );
        }

        // Filter active transaction details
        const activeDetails = (header.reqTransactionDetails || []).filter(
          (detail) => detail.status_id === 1 || detail.status_id === 18, // ADDITIONAL TERMINATED STATUS CHECK
        );

        if (activeDetails.length === 0) {
          return;
        }

        const requirementName =
          header.requirement?.requirement_name || "UNKNOWN";
        const reqMap = transactionsByWarehouseAndReq.get(header.warehouse_id)!;

        if (!reqMap.has(requirementName)) {
          reqMap.set(requirementName, []);
        }

        // Build transaction object with dues and details
        const transaction = {
          trans_header_id: header.id,
          created_user: header.createdBy
            ? `${header.createdBy.first_name} ${header.createdBy.last_name}`
            : null,
          created_at: header.created_at,
          trans_date: this.commonUtilitiesService.formatDateString(
            header.trans_date,
          ),
          trans_due_status_name:
            header.trans_due_status_id === 1 ? "ON TIME" : "OVERDUE",
          renewal_type_name:
            header.requirement?.renewalType?.renewal_type_name || null,
          req_transaction_due_id:
            header.reqTransactionDues && header.reqTransactionDues.length > 0
              ? header.reqTransactionDues[0].id
              : null,
          warehouse_requirement_due_id:
            header.reqTransactionDues && header.reqTransactionDues.length > 0
              ? header.reqTransactionDues[0].warehouse_requirement_due_id
              : null,
          warehouse_requirement_due_start:
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0 &&
            header.reqTransactionDues[0].warehouseRequirementDue
              ? this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_start,
                )
              : null,
          warehouse_requirement_due_end:
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0 &&
            header.reqTransactionDues[0].warehouseRequirementDue
              ? this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_end,
                )
              : null,
          warehouse_requirement_due_date:
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0 &&
            header.reqTransactionDues[0].warehouseRequirementDue
              ? this.commonUtilitiesService.formatDateString(
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_date,
                )
              : null,
          warehouse_requirement_due_status_id:
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0 &&
            header.reqTransactionDues[0].warehouseRequirementDue
              ? header.reqTransactionDues[0].warehouseRequirementDue.status_id
              : null,
          warehouse_requirement_due_status_name:
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0 &&
            header.reqTransactionDues[0].warehouseRequirementDue
              ? this.getWarehouseRequirementDueStatus(
                  requirementTypeId,
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_date,
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .warehouse_requirement_due_end,
                  header.reqTransactionDues[0].warehouseRequirementDue
                    .status_id,
                )
              : null,
          warehouse_requirement_due_reminder_name: "-",
          warehouse_requirement_due_reminder_days_diff: null,
          trans_details: activeDetails.map((detail) => ({
            trans_detail_id: detail.id,
            requirement_file_path: detail.requirement_file_path || null,
            requirement_file_name:
              this.commonUtilitiesService.formatTransFileName(
                detail.requirement_file_name,
              ) || null,
          })),
        };

        reqMap.get(requirementName)!.push(transaction);
      });

      // Step 9: Get base requirements details
      const baseRequirementsPromises = warehouses.map((warehouse) =>
        this.getBaseRequirementsDetailsFromWarehouse(
          warehouse,
          date_from,
          date_to,
          false,
          flatten,
        ),
      );
      const baseRequirementsDataArray = await Promise.all(
        baseRequirementsPromises,
      );

      // Step 10: Build final response per warehouse
      const today = formatDateToString(new Date());
      const todayDate = new Date(today);

      const result = warehouses.map((warehouse, idx) => {
        const baseRequirementsData = baseRequirementsDataArray[idx];
        const transactionsByReq =
          transactionsByWarehouseAndReq.get(warehouse.id) ||
          new Map<string, any[]>();

        // Build requirements object keyed by requirement name
        const requirementsObj: any = {};
        let totalTransactedCount = 0;
        let totalTransactedPercentage = 0;

        for (const requirement of activeRequirements) {
          const reqName = requirement.requirement_name;
          const reqTransactions = transactionsByReq.get(reqName) || [];
          const actualNo = reqTransactions.length;

          if (requirementTypeId === 2) {
            // NEW FORMAT: Three-column categorization with ave_due_age and min_due_age
            const activeTransactions = new Set<number>();
            const dueTransactions = new Set<number>();
            const expiredTransactions = new Set<number>();
            const terminatedTransactions = new Set<number>();
            const dueAges: number[] = [];

            reqTransactions.forEach((transaction) => {
              // Extract warehouse_requirement_due information
              const wrd = transaction.warehouse_requirement_due_id
                ? {
                    warehouse_requirement_due_date:
                      transaction.warehouse_requirement_due_date,
                    warehouse_requirement_due_end:
                      transaction.warehouse_requirement_due_end,
                  }
                : null;

              if (!wrd) return;

              // ✅ Check for TERMINATED status (status_id = 18)
              console.log("Checking transaction for TERMINATED status_id:", {
                transactionId: transaction.trans_header_id,
                statusId: transaction.warehouse_requirement_due_status_id,
              });
              if (transaction.warehouse_requirement_due_status_id === 18) {
                terminatedTransactions.add(transaction.trans_header_id);
                return; // Skip date-based categorization
              }

              const dueDate = new Date(wrd.warehouse_requirement_due_date);
              const dueEndDate = new Date(wrd.warehouse_requirement_due_end);

              // Categorize based on dates
              if (dueDate > todayDate) {
                // ACTIVE
                activeTransactions.add(transaction.trans_header_id);
              } else if (dueDate <= todayDate && dueEndDate > todayDate) {
                // DUE FOR RENEWAL
                dueTransactions.add(transaction.trans_header_id);
              }

              if (dueEndDate <= todayDate) {
                // EXPIRED
                expiredTransactions.add(transaction.trans_header_id);
              }

              // Collect all daysUntilEnd values (including negative/expired)
              const daysUntilEnd = Math.floor(
                (dueEndDate.getTime() - todayDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              dueAges.push(daysUntilEnd);
            });

            const activeCount = activeTransactions.size;
            const dueCount = dueTransactions.size;
            const expiredCount = expiredTransactions.size;
            const terminatedCount = terminatedTransactions.size;

            // Calculate average and minimum due_age using reusable method (excludeExpired=true)
            const dueAgeResult = this.calculateDueAges(dueAges, true);
            const aveDueAge = dueAgeResult.ave_due_age;
            const minDueAge = dueAgeResult.min_due_age;

            requirementsObj[reqName] = {
              active: {
                actual_no: activeCount,
                percentage: activeCount > 0 ? 100 : 0,
              },
              due_for_renewal: {
                actual_no: dueCount,
                percentage: dueCount > 0 ? 100 : 0,
              },
              expired: {
                actual_no: expiredCount,
                percentage: expiredCount > 0 ? 100 : 0,
              },
              terminated: {
                actual_no: terminatedCount,
                percentage: terminatedCount > 0 ? 100 : 0,
              },
              ave_due_age: aveDueAge,
              min_due_age: minDueAge,
              transactedRequirements: reqTransactions,
            };

            totalTransactedCount += actualNo;
          } else {
            // ORIGINAL FORMAT (requirementTypeId = 1): Single column per requirement
            requirementsObj[reqName] = {
              actual_no: actualNo,
              percentage: actualNo > 0 ? 100 : 0, // 100 if has transactions, 0 if none
              transactedRequirements: reqTransactions,
            };

            totalTransactedCount += actualNo;
          }
        }

        const totalTransactedPercentageCalc =
          baseRequirementsData.base_requirement_with_dues_count > 0
            ? Math.round(
                (totalTransactedCount /
                  baseRequirementsData.base_requirement_with_dues_count) *
                  100,
              )
            : 0;
        // console.log("baseRequirementsData:", baseRequirementsData.base_requirement_details);

        return {
          id: warehouse.id,
          location_name: warehouse.location?.location_name || null,
          location_abbr: warehouse.location?.location_abbr || null,
          warehouse_name: warehouse.warehouse_name,
          warehouse_ifs: warehouse.warehouse_ifs,
          warehouse_code: warehouse.warehouse_code,
          warehouse_type_id: warehouse.warehouse_type_id,
          warehouse_type_name:
            warehouse.warehouseType?.warehouse_type_name || null,
          warehouse_rem_status_name: warehouse.remStatus?.status_name || null,
          warehouse_created_year: warehouse.created_at
            ? new Date(warehouse.created_at).getFullYear()
            : null,
          baseRequirements: baseRequirementsData,
          requirements: requirementsObj,
          total_transacted_requirements: {
            actual_no: totalTransactedCount,
            percentage: totalTransactedPercentageCalc,
          },
        };
      });

      // Step 11: Apply baseRequirements filter
      if (baseRequirementsFilter === "withRequirements") {
        // Only include warehouses with baseRequirements.base_requirement_with_dues_count > 0
        return result.filter(
          (warehouse) =>
            warehouse.baseRequirements.base_requirement_with_dues_count > 0,
        );
      } else if (baseRequirementsFilter === "withoutRequirements") {
        // Only include warehouses with baseRequirements.base_requirement_with_dues_count = 0
        return result.filter(
          (warehouse) =>
            warehouse.baseRequirements.base_requirement_with_dues_count === 0,
        );
      }
      // If 'all', return all warehouses (no filtering)

      // return {
      //   success: true,
      //   data: result,
      //   total: result.length,
      // };
      return result;
    } catch (error) {
      logger.error(
        "Error fetching warehouse requirements detailed listing per store:",
        error,
      );
      throw new BadRequestException(
        `Failed to fetch warehouse requirements detailed listing: ${(error as Error).message}`,
      );
    }
  }

  // A helper function to determine the warehouse requirement status based on due date, cycle end and requirement type
  public getWarehouseRequirementDueStatus(
    requirementTypeId: number,
    dueDate: string,
    dueEndDate: string,
    dueStatusId: number,
  ): string {
    // Implementation for fetching warehouse requirement due status
    const today = formatDateToString(new Date());
    const todayDate = new Date(today);
    const dueDateVal = new Date(dueDate);
    const dueEndDateVal = new Date(dueEndDate);
    let statusName = "UNKNOWN";
    if (requirementTypeId === 1) {
      if (dueStatusId === 1) {
        statusName = "NOT FULFILLED";
      } else {
        statusName = "FULFILLED";
      }
    } else if (requirementTypeId === 2) {
      if (dueStatusId === 18) {
        // ADDITIONAL TERMINATED STATUS CHECK
        statusName = "TERMINATED";
      } else {
        if (dueDateVal > todayDate) {
          statusName = "ACTIVE";
        } else if (dueDateVal <= todayDate && dueEndDateVal > todayDate) {
          statusName = "DUE FOR RENEWAL";
        } else if (dueEndDateVal <= todayDate) {
          statusName = "EXPIRED";
        }
      }
    }

    return statusName;
  }

  private async activeRequirements(requirementTypeId?: number) {
    let activeRequirementWhere: any = { status_id: 1 };
    if (requirementTypeId) {
      activeRequirementWhere.requirement_type_id = requirementTypeId;
    }
    const activeRequirements = await this.requirementsRepository.find({
      where: activeRequirementWhere,
      order: { id: "ASC" },
    });
    return activeRequirements;
  }

  private async getWarehouses(
    warehouse_type_id: number,
    warehouse_rem_status_id?: number[],
    date_to?: string,
    accessKeyId?: number,
    finalLocationIds: number[] = [],
    orderBy: any = { id: "ASC" },
    relations: string[] = ["location"],
  ) {
    const warehouseWhere: any = {
      warehouse_type_id,
      rem_status_id: In(warehouse_rem_status_id || [8, 9]),
    };

    const end_date = date_to ? endOfLocalRange(date_to) : null;
    if (date_to) {
      warehouseWhere.created_at = LessThanOrEqual(end_date);
    }

    if (accessKeyId !== undefined && accessKeyId !== null) {
      warehouseWhere.access_key_id = accessKeyId;
    }

    if (finalLocationIds.length > 0) {
      warehouseWhere.location_id = In(finalLocationIds);
    }

    // Fetch warehouses with location and type relations
    const warehouses = await this.warehousesRepository.find({
      where: warehouseWhere,
      relations: relations,
      order: orderBy,
    });

    return warehouses;
  }
}
