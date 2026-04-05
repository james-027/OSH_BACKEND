import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { WarehouseRequirementStart } from "../entities/WarehouseRequirementStart";
import { WarehouseRequirement } from "../entities/WarehouseRequirement";
import { Requirement } from "../entities/Requirement";
import { SyncLog } from "../entities/syncLog";
import { formatDateToString } from "../utils/date.utils";
import logger from "src/config/logger";

@Injectable()
export class WarehouseRequirementStartsService {
  constructor(
    @InjectRepository(WarehouseRequirementStart)
    private warehouseRequirementStartsRepository: Repository<WarehouseRequirementStart>,
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
  ) {}

  /**
   * Create ONE start record per warehouse_requirement_id EVER (non-recurring)
   * Calculates start date based on requirement's start_days + start_month + current year
   */
  async createStartForWarehouseRequirement(
    warehouseRequirementId: number,
    userId: number = 1,
  ): Promise<WarehouseRequirementStart | null> {
    try {
      // Check if a start record already exists for this warehouse_requirement_id (unique check)
      const existingStart =
        await this.warehouseRequirementStartsRepository.findOne({
          where: { warehouse_requirement_id: warehouseRequirementId },
        });

      if (existingStart) {
        // Skip creation when start already exists (no error)
        return null;
      }

      // Fetch the warehouse requirement with its requirement and warehouse details
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id: warehouseRequirementId },
          relations: ["requirement", "warehouse"],
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${warehouseRequirementId} not found`,
        );
      }

      const requirement = warehouseRequirement.requirement;
      const warehouse = warehouseRequirement.warehouse;

      if (!requirement) {
        throw new NotFoundException(
          `Requirement not found for warehouse requirement ID ${warehouseRequirementId}`,
        );
      }

      // Calculate effectiveYear based on warehouse.created_at
      const year = new Date().getFullYear();
      const warehouseCreatedYear = warehouse?.created_at
        ? new Date(warehouse.created_at).getFullYear()
        : year;
      const effectiveYear = Math.max(year, warehouseCreatedYear);

      // Use extracted method for start date calculation (DRY principle)
      const startDate = this.calculateStartDate(
        requirement.renewal_type_id,
        requirement.requirement_start,
        requirement.requirement_start_days,
        effectiveYear,
      );

      // Convert date to YYYY-MM-DD format for database (local date, not UTC)
      const startDateString = formatDateToString(startDate);

      // Create the start record
      const newStart = this.warehouseRequirementStartsRepository.create({
        warehouse_requirement_id: warehouseRequirementId,
        warehouse_requirement_start: startDateString,
        status_id: 1,
        created_by: userId,
      });

      const savedStart =
        await this.warehouseRequirementStartsRepository.save(newStart);

      // created successfully

      return savedStart;
    } catch (error) {
      // Skip duplicate key errors silently (expected when syncing repeatedly)
      const err = error as Error;
      if (err.message && err.message.includes("Duplicate entry")) {
        return null; // Silently skip
      }

      // Log other errors to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT START",
          type: "error",
          action: "data insertion",
          message: err.message || String(error),
          row_data: JSON.stringify({
            warehouseRequirementId,
          }),
        });
      } catch (logError) {
        // swallow logging error
      }

      throw error;
    }
  }

  /**
   * Batch create starts for multiple warehouse requirements with bulk insertion
   * One start per warehouse_requirement_id (non-recurring)
   * @param warehouseRequirementIds Array of warehouse requirement IDs
   * @param year Specific year for start dates (default: current year)
   * @param chunkSize Batch size for bulk insertion (default 1000)
   * @param userId User ID for audit (default 1)
   */
  async createStartsForWarehouseRequirements(
    warehouseRequirementIds: number[],
    year: number = new Date().getFullYear(),
    chunkSize: number = 1000,
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

    if (warehouseRequirementIds.length === 0) {
      return result;
    }

    try {
      // Fetch all warehouse requirements with their requirement details
      const warehouseRequirements =
        await this.warehouseRequirementsRepository.find({
          where: {
            id: In(warehouseRequirementIds),
          },
          relations: ["requirement", "warehouse"],
        });

      // Map for quick lookup
      const wrMap = new Map(warehouseRequirements.map((wr) => [wr.id, wr]));

      // Build start records to insert (after checking unique constraints)
      const startsToInsert: WarehouseRequirementStart[] = [];

      for (const wrId of warehouseRequirementIds) {
        const warehouseRequirement = wrMap.get(wrId);
        if (!warehouseRequirement || !warehouseRequirement.requirement) {
          result.skipped++;
          continue;
        }

        const requirement = warehouseRequirement.requirement;
        const warehouse = warehouseRequirement.warehouse;

        // Get the year from warehouse.created_at and use the higher year
        const warehouseCreatedYear = warehouse?.created_at
          ? new Date(warehouse.created_at).getFullYear()
          : year;
        const effectiveYear = Math.max(year, warehouseCreatedYear);

        // Calculate start date
        const startDate = this.calculateStartDate(
          requirement.renewal_type_id,
          requirement.requirement_start,
          requirement.requirement_start_days,
          effectiveYear,
        );
        const startDateString = formatDateToString(startDate);

        // Check unique constraint: (warehouse_requirement_id, start)
        // Only one start record per warehouse_requirement_id ever
        const existingStart =
          await this.warehouseRequirementStartsRepository.findOne({
            where: {
              warehouse_requirement_id: wrId,
            },
          });

        if (existingStart) {
          result.skipped++;
          continue;
        }

        // Add to batch
        const newStart = this.warehouseRequirementStartsRepository.create({
          warehouse_requirement_id: wrId,
          warehouse_requirement_start: startDateString,
          status_id: 1,
          created_by: userId,
        });

        startsToInsert.push(newStart);
      }

      // Batch insert in chunks
      for (let i = 0; i < startsToInsert.length; i += chunkSize) {
        const chunk = startsToInsert.slice(i, i + chunkSize);
        try {
          const savedChunk =
            await this.warehouseRequirementStartsRepository.save(chunk);
          result.created += savedChunk.length;
        } catch (chunkError) {
          const chunkErr = chunkError as Error;
          result.errors.push(
            `Failed to batch insert starts chunk: ${chunkErr.message}`,
          );
        }
      }

      return result;
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Failed to create starts: ${err.message}`);
      // Log to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT START",
          type: "error",
          action: "data insertion",
          message: err.message || String(error),
          row_data: JSON.stringify({ warehouseRequirementIds }),
        });
      } catch (logErr) {
        // ignore logging failure
      }

      return result;
    }
  }

  /**
   * Calculate start date for a requirement
   * Used by both creation and update flows
   * @param renewalTypeId The renewal type ID
   * @param requirementStart Month (1-12)
   * @param requirementStartDays Day of month
   * @returns Calculated date
   */
  private calculateStartDate(
    renewalTypeId: number,
    requirementStart: number,
    requirementStartDays: number,
    effectiveYear: number = new Date().getFullYear(),
  ): Date {
    if (renewalTypeId === 1) {
      // ONE TIME: use today
      return new Date();
    } else {
      // OTHER TYPES: use requirement_start month/day + effective year
      return new Date(
        effectiveYear,
        requirementStart - 1, // Month is 0-indexed in JS Date
        requirementStartDays,
      );
    }
  }

  /**
   * Update warehouse requirement start dates when requirement details change
   * Supports two strategies:
   * - 'allYears': Use dynamic year based on warehouse.created_at (original behavior - updates all)
   * - 'currentOnly': Use passed year parameter, filter by status_id=1 + year match
   * @param requirementId The requirement ID to update starts for
   * @param renewalTypeId New renewal type ID
   * @param requirementStart New requirement start month
   * @param requirementStartDays New requirement start day
   * @param year Year parameter (used for calculation in currentOnly strategy)
   * @param updateStrategy 'allYears' | 'currentOnly' (default: 'allYears')
   */
  async updateStartsForRequirement(
    requirementId: number,
    renewalTypeId: number,
    requirementStart: number,
    requirementStartDays: number,
    year: number = new Date().getFullYear(),
    updateStrategy: "allYears" | "currentOnly" = "allYears",
  ): Promise<{ updated: number }> {
    try {
      // Get all warehouse requirements with warehouse info for dynamic year calculation
      const warehouseRequirements = await this.warehouseRequirementsRepository
        .createQueryBuilder("wr")
        .leftJoinAndSelect("wr.warehouse", "w")
        .where("wr.requirement_id = :requirementId", { requirementId })
        .select(["wr.id", "w.created_at"])
        .getMany();

      if (warehouseRequirements.length === 0) {
        return { updated: 0 };
      }

      let totalUpdated = 0;

      if (updateStrategy === "currentOnly") {
        // Strategy: Use passed year, filter by year + status_id=1
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;

        const warehouseRequirementIds = warehouseRequirements.map(
          (wr) => wr.id,
        );

        // Calculate date using passed year
        const newStartDate = this.calculateStartDate(
          renewalTypeId,
          requirementStart,
          requirementStartDays,
          year,
        );
        const newStartDateString = formatDateToString(newStartDate);

        const result = await this.warehouseRequirementStartsRepository
          .createQueryBuilder()
          .update(WarehouseRequirementStart)
          .set({ warehouse_requirement_start: newStartDateString })
          .where("warehouse_requirement_id IN (:...warehouseRequirementIds)", {
            warehouseRequirementIds,
          })
          .andWhere("status_id = 1")
          .andWhere(
            "warehouse_requirement_start BETWEEN :yearStart AND :yearEnd",
            {
              yearStart,
              yearEnd,
            },
          )
          .execute();

        totalUpdated = result.affected || 0;
      } else {
        // Strategy 'allYears': Use dynamic year per warehouse (original behavior)
        for (const wr of warehouseRequirements) {
          // Calculate effectiveYear based on warehouse.created_at (original logic)
          const warehouseCreatedYear = wr.warehouse?.created_at
            ? new Date(wr.warehouse.created_at).getFullYear()
            : year;
          const effectiveYear = Math.max(year, warehouseCreatedYear);

          // Calculate new start date using effectiveYear
          const newStartDate = this.calculateStartDate(
            renewalTypeId,
            requirementStart,
            requirementStartDays,
            effectiveYear,
          );
          const newStartDateString = formatDateToString(newStartDate);

          // Update all starts for this warehouse requirement
          const result = await this.warehouseRequirementStartsRepository.update(
            { warehouse_requirement_id: wr.id },
            { warehouse_requirement_start: newStartDateString },
          );

          totalUpdated += result.affected || 0;
        }
      }

      return { updated: totalUpdated };
    } catch (error) {
      logger.error(
        `Error updating starts for requirement ${requirementId}:`,
        error,
      );
      throw error;
    }
  }
}
