import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { WarehouseRequirementDue } from "../entities/WarehouseRequirementDue";
import { WarehouseRequirement } from "../entities/WarehouseRequirement";
import { Requirement } from "../entities/Requirement";
import { SyncLog } from "../entities/syncLog";
import { formatDateToString } from "../utils/date.utils";
import { ResponseMapperService } from "./response-mapper.service";
import { CommonUtilitiesService } from "./common-utilities.service";

@Injectable()
export class WarehouseRequirementDuesService {
  constructor(
    @InjectRepository(WarehouseRequirementDue)
    private warehouseRequirementDuesRepository: Repository<WarehouseRequirementDue>,
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    private responseMapperService: ResponseMapperService,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  /**
   * Create a warehouse requirement due for a newly created warehouse requirement
   * Calculates due_start based on requirement's start_days + start_month + current year
   * Calculates due_end based on renewal_type_id (ONE TIME, ANNUAL, QUARTERLY, MONTHLY)
   */
  async createDueForWarehouseRequirement(
    warehouseRequirementId: number,
    userId: number = 1,
  ): Promise<WarehouseRequirementDue | null> {
    try {
      // Fetch the warehouse requirement with its requirement details
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id: warehouseRequirementId },
          relations: ["requirement", "requirement.renewalType"],
        });

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${warehouseRequirementId} not found`,
        );
      }

      const requirement = warehouseRequirement.requirement;

      if (!requirement) {
        throw new NotFoundException(
          `Requirement not found for warehouse requirement ID ${warehouseRequirementId}`,
        );
      }

      // Calculate warehouse_requirement_due_start: current_year + requirement_start (month) + requirement_start_days (day)
      const currentYear = new Date().getFullYear();
      let dueStartDate = new Date(
        currentYear,
        requirement.requirement_start - 1, // Month is 0-indexed in JS Date
        requirement.requirement_start_days,
      );

      // Calculate warehouse_requirement_due_end based on renewal_type_id
      let dueEndDate: Date;

      switch (requirement.renewal_type_id) {
        case 1: // ONE TIME -> use today for both start and end
          dueStartDate = new Date();
          dueEndDate = new Date();
          break;

        case 2: // ANNUAL
          dueEndDate = new Date(dueStartDate);
          dueEndDate.setFullYear(dueEndDate.getFullYear() + 1);
          break;

        case 3: // QUARTERLY
          dueEndDate = new Date(dueStartDate);
          dueEndDate.setMonth(dueEndDate.getMonth() + 3);
          break;

        case 4: // MONTHLY
          dueEndDate = new Date(dueStartDate);
          dueEndDate.setMonth(dueEndDate.getMonth() + 1);
          break;

        default:
          throw new BadRequestException(
            `Invalid renewal_type_id: ${requirement.renewal_type_id}`,
          );
      }

      // Convert dates to YYYY-MM-DD format for database
      const dueStartString = dueStartDate.toISOString().split("T")[0];
      const dueEndString = dueEndDate.toISOString().split("T")[0];

      // Check if this combination already exists (unique check)
      const existingDue = await this.warehouseRequirementDuesRepository.findOne(
        {
          where: {
            warehouse_requirement_id: warehouseRequirementId,
            warehouse_requirement_due_start: dueStartString,
            warehouse_requirement_due_end: dueEndString,
          },
        },
      );

      if (existingDue) {
        // Skip creation when duplicate exists (no error)
        return null;
      }

      // Create the due record
      const newDue = this.warehouseRequirementDuesRepository.create({
        warehouse_requirement_id: warehouseRequirementId,
        warehouse_requirement_due_start: dueStartString,
        warehouse_requirement_due_end: dueEndString,
        status_id: 1,
        created_by: userId,
      });

      const savedDue =
        await this.warehouseRequirementDuesRepository.save(newDue);

      // console.log(
      //   `Created warehouse requirement due ID ${savedDue.id} for warehouse_requirement_id ${warehouseRequirementId}`
      // );

      return savedDue;
    } catch (error) {
      // Skip duplicate key errors silently (expected when syncing repeatedly)
      if (error.message && error.message.includes("Duplicate entry")) {
        return null; // Silently skip
      }

      // Log other errors to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE",
          type: "error",
          action: "data insertion",
          message: error.message || String(error),
          row_data: JSON.stringify({
            warehouseRequirementId,
          }),
        });
      } catch (logError) {
        // swallow logging error to avoid masking original error
      }

      throw error;
    }
  }

  /**
   * Batch create dues for multiple warehouse requirements with bulk insertion
   * @param warehouseRequirementIds Array of warehouse requirement IDs
   * @param year Specific year for due dates (default: current year)
   * @param chunkSize Batch size for bulk insertion (default 1000)
   * @param userId User ID for audit (default 1)
   */
  async createDuesForWarehouseRequirements(
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
          relations: ["requirement", "warehouse", "requirement.renewalType"],
        });

      // Map for quick lookup
      const wrMap = new Map(warehouseRequirements.map((wr) => [wr.id, wr]));

      // Build due records to insert (after checking unique constraints)
      const duesToInsert: WarehouseRequirementDue[] = [];

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

        // Calculate dates
        const today = new Date();
        let dueStartDate = new Date(
          effectiveYear,
          today.getMonth(),
          today.getDate(),
        );
        if (
          requirement.requirement_start >= 1 &&
          requirement.requirement_start <= 12
        ) {
          dueStartDate = new Date(
            effectiveYear,
            requirement.requirement_start - 1,
            requirement.requirement_start_days,
          );
        }

        let dueEndDate: Date;
        switch (requirement.renewal_type_id) {
          case 1: // ONE TIME - use today's month/day in specified year
            dueStartDate = new Date(
              effectiveYear,
              today.getMonth(),
              today.getDate(),
            );
            dueEndDate = new Date(
              effectiveYear,
              today.getMonth(),
              today.getDate(),
            );
            break;
          case 2: // ANNUAL
            dueEndDate = new Date(dueStartDate);
            dueEndDate.setFullYear(dueEndDate.getFullYear() + 1);
            break;
          case 3: // QUARTERLY
            dueEndDate = new Date(dueStartDate);
            dueEndDate.setMonth(dueEndDate.getMonth() + 3);
            break;
          case 4: // MONTHLY
            dueEndDate = new Date(dueStartDate);
            dueEndDate.setMonth(dueEndDate.getMonth() + 1);
            break;
          default:
            result.errors.push(
              `Invalid renewal_type_id ${requirement.renewal_type_id} for warehouse_requirement ${wrId}`,
            );
            result.skipped++;
            continue;
        }

        const preDueReminderDate = new Date(dueStartDate);
        preDueReminderDate.setDate(
          preDueReminderDate.getDate() - requirement.requirement_reminder,
        );

        const DueReminderDueDate = new Date(dueStartDate);
        DueReminderDueDate.setDate(
          DueReminderDueDate.getDate() + requirement.requirement_due_days,
        );

        const postDueReminderDate = new Date(dueStartDate);
        postDueReminderDate.setDate(
          postDueReminderDate.getDate() + requirement.requirement_reminder,
        );

        if (requirement.renewal_type_id !== 1) {
          //* Deduct one day to the end of cycle.
          dueEndDate = this.commonUtilitiesService.deductDaysFromDate(
            dueEndDate,
            1,
          );
        }

        const dueStartString = formatDateToString(dueStartDate);
        const dueEndString = formatDateToString(dueEndDate);
        const preDueReminderString = formatDateToString(preDueReminderDate);
        const postDueReminderString = formatDateToString(postDueReminderDate);
        const dueReminderDueString = formatDateToString(DueReminderDueDate);

        // Check unique constraint: (warehouse_requirement_id, due_start, due_end)
        const existingDue =
          await this.warehouseRequirementDuesRepository.findOne({
            where: {
              warehouse_requirement_id: wrId,
              warehouse_requirement_due_start: dueStartString,
              warehouse_requirement_due_end: dueEndString,
            },
          });

        if (existingDue) {
          result.skipped++;
          continue;
        }

        // Add to batch
        const newDue = this.warehouseRequirementDuesRepository.create({
          warehouse_requirement_id: wrId,
          warehouse_requirement_due_start: dueStartString,
          warehouse_requirement_due_end: dueEndString,
          warehouse_requirement_due_pre_reminder_date: preDueReminderString,
          warehouse_requirement_due_post_reminder_date: postDueReminderString,
          warehouse_requirement_due_date: dueReminderDueString,
          status_id: 1,
          created_by: userId,
        });

        duesToInsert.push(newDue);
      }

      // Batch insert in chunks
      for (let i = 0; i < duesToInsert.length; i += chunkSize) {
        const chunk = duesToInsert.slice(i, i + chunkSize);
        try {
          const savedChunk =
            await this.warehouseRequirementDuesRepository.save(chunk);
          result.created += savedChunk.length;
        } catch (chunkError) {
          result.errors.push(
            `Failed to batch insert dues chunk: ${chunkError.message}`,
          );
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Failed to create dues: ${error.message}`);
      // Log to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE",
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

      warehouseRequirement.status_id = 2; // deactivate
      warehouseRequirement.updated_by = userId;

      if (!warehouseRequirement) {
        throw new NotFoundException(
          `Warehouse requirement with ID ${id} not found`,
        );
      }

      warehouseRequirement.status_id = 2; // deactivate
      warehouseRequirement.updated_by = userId;

      await this.warehouseRequirementsRepository.save(warehouseRequirement);

      return this.responseMapperService.mapEntityToResponse(
        warehouseRequirement,
      );
    } catch (error) {
      console.error("Error toggling warehouse requirement status:", error);
      throw new Error("Failed to toggle warehouse requirement status");
    }
  }
}
