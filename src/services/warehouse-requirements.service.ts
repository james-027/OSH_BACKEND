import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { Warehouse } from "src/entities/Warehouse";
import { Requirement } from "src/entities/Requirement";
import { CreateWarehouseRequirementDto } from "src/dto/CreateWarehouseRequirementDto";
import { UpdateWarehouseRequirementDto } from "src/dto/UpdateWarehouseRequirementDto";
import { ResponseMapperService } from "./response-mapper.service";
import { WarehouseRequirementDuesService } from "./warehouse-requirement-dues.service";
import { WarehouseRequirementStartsService } from "./warehouse-requirement-starts.service";
import { SyncLog } from "src/entities/syncLog";

@Injectable()
export class WarehouseRequirementsService {
  constructor(
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private warehouseRequirementDuesService: WarehouseRequirementDuesService,
    private warehouseRequirementStartsService: WarehouseRequirementStartsService,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>
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

      const newStatusId = warehouseRequirement.status_id === 1 ? 2 : 1;

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
}
