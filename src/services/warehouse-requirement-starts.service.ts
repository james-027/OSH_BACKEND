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
    private syncLogRepository: Repository<SyncLog>
  ) {}

  /**
   * Create ONE start record per warehouse_requirement_id EVER (non-recurring)
   * Calculates start date based on requirement's start_days + start_month + current year
   */
  async createStartForWarehouseRequirement(
    warehouseRequirementId: number,
    userId: number = 1
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

      // Fetch the warehouse requirement with its requirement details
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id: warehouseRequirementId },
          relations: ["requirement"],
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${warehouseRequirementId} not found`
        );
      }

      const requirement = warehouseRequirement.requirement;

      if (!requirement) {
        throw new NotFoundException(
          `Requirement not found for warehouse requirement ID ${warehouseRequirementId}`
        );
      }

      // Calculate warehouse_requirement_start based on renewal_type_id
      let startDate: Date;

      if (requirement.renewal_type_id === 1) {
        // ONE TIME: use today
        startDate = new Date();
      } else {
        // OTHER TYPES: use requirement_start month/day + current year
        const currentYear = new Date().getFullYear();
        startDate = new Date(
          currentYear,
          requirement.requirement_start - 1, // Month is 0-indexed in JS Date
          requirement.requirement_start_days
        );
      }

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
      if (error.message && error.message.includes("Duplicate entry")) {
        return null; // Silently skip
      }

      // Log other errors to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT START",
          type: "error",
          action: "data insertion",
          message: error.message || String(error),
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
    userId: number = 1
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
          relations: ["requirement"],
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

        // Calculate start date based on renewal_type_id
        let startDate: Date;

        if (requirement.renewal_type_id === 1) {
          // ONE TIME: use today's month/day in specified year
          const today = new Date();
          startDate = new Date(year, today.getMonth(), today.getDate());
        } else {
          // OTHER TYPES: use requirement_start month/day + specified year
          startDate = new Date(
            year,
            requirement.requirement_start - 1,
            requirement.requirement_start_days
          );
        }

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
          result.errors.push(
            `Failed to batch insert starts chunk: ${chunkError.message}`
          );
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Failed to create starts: ${error.message}`);
      // Log to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT START",
          type: "error",
          action: "data insertion",
          message: error.message || String(error),
          row_data: JSON.stringify({ warehouseRequirementIds }),
        });
      } catch (logErr) {
        // ignore logging failure
      }

      return result;
    }
  }
}
