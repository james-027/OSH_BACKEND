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
import logger from "src/config/logger";

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
      // Fetch the warehouse requirement with its requirement and warehouse details
      const warehouseRequirement =
        await this.warehouseRequirementsRepository.findOne({
          where: { id: warehouseRequirementId },
          relations: ["requirement", "requirement.renewalType", "warehouse"],
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

      // Use extracted method for due date calculations (DRY principle)
      const dueDateData = this.calculateDueDates(
        requirement.renewal_type_id,
        requirement.requirement_start,
        requirement.requirement_start_days,
        requirement.requirement_reminder || 0,
        requirement.requirement_due_days || 0,
        effectiveYear,
      );

      const dueStartString = dueDateData.dueStart;
      const dueEndString = dueDateData.dueEnd;

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
        warehouse_requirement_due_pre_reminder_date: dueDateData.preDueReminder,
        warehouse_requirement_due_post_reminder_date:
          dueDateData.postDueReminder,
        warehouse_requirement_due_date: dueDateData.dueDate,
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
      const err = error as Error;
      if (err.message && err.message.includes("Duplicate entry")) {
        return null; // Silently skip
      }

      // Log other errors to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE",
          type: "error",
          action: "data insertion",
          message: err.message || String(error),
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

        // Calculate dates using extracted method (DRY principle)
        let dueStartString: string;
        let dueEndString: string;
        let preDueReminderString: string;
        let postDueReminderString: string;
        let dueReminderDueString: string;

        try {
          const dueDateData = this.calculateDueDates(
            requirement.renewal_type_id,
            requirement.requirement_start,
            requirement.requirement_start_days,
            requirement.requirement_reminder || 0,
            requirement.requirement_due_days || 0,
            effectiveYear,
          );

          dueStartString = dueDateData.dueStart;
          dueEndString = dueDateData.dueEnd;
          preDueReminderString = dueDateData.preDueReminder;
          postDueReminderString = dueDateData.postDueReminder;
          dueReminderDueString = dueDateData.dueDate;
        } catch (calcError) {
          const calcErr = calcError as Error;
          result.errors.push(
            `Failed to calculate due dates for warehouse_requirement ${wrId}: ${calcErr.message}`,
          );
          result.skipped++;
          continue;
        }

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
          const chunkErr = chunkError as Error;
          result.errors.push(
            `Failed to batch insert dues chunk: ${chunkErr.message}`,
          );
        }
      }

      return result;
    } catch (error) {
      const err = error as Error;
      result.errors.push(`Failed to create dues: ${err.message}`);
      // Log to sync_logs
      try {
        await this.syncLogRepository.save({
          module: "WAREHOUSE REQUIREMENT DUE",
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

  /**
   * Calculate due dates for a requirement
   * Used by both creation and update flows
   * @param renewalTypeId The renewal type ID
   * @param requirementStart Month (1-12)
   * @param requirementStartDays Day of month
   * @param requirementReminder Days to use for reminder calculations
   * @param requirementDueDays Days after start for actual due date
   * @returns Object with calculated dates
   */
  private calculateDueDates(
    renewalTypeId: number,
    requirementStart: number,
    requirementStartDays: number,
    requirementReminder: number,
    requirementDueDays: number,
    effectiveYear: number = new Date().getFullYear(),
  ): {
    dueStart: string;
    dueEnd: string;
    preDueReminder: string;
    postDueReminder: string;
    dueDate: string;
  } {
    const today = new Date();

    // ALWAYS initialize with effectiveYear + today's month and day
    let dueStartDate = new Date(
      effectiveYear,
      today.getMonth(),
      today.getDate(),
    );

    // IF requirement_start is valid (1-12), override with requirement_start month and requirement_start_days
    if (requirementStart >= 1 && requirementStart <= 12) {
      dueStartDate = new Date(
        effectiveYear,
        requirementStart - 1, // Month is 0-indexed in JS Date
        requirementStartDays,
      );
    }

    let dueEndDate: Date;

    switch (renewalTypeId) {
      case 1: // ONE TIME - use today's month/day in specified year
        dueStartDate = new Date(
          effectiveYear,
          today.getMonth(),
          today.getDate(),
        );
        dueEndDate = new Date(effectiveYear, today.getMonth(), today.getDate());
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
          `Invalid renewal_type_id: ${renewalTypeId}`,
        );
    }

    // Calculate reminder dates
    const preDueReminderDate = new Date(dueStartDate);
    preDueReminderDate.setDate(
      preDueReminderDate.getDate() - requirementReminder,
    );

    const actualDueDate = new Date(dueStartDate);
    actualDueDate.setDate(actualDueDate.getDate() + requirementDueDays);

    const postDueReminderDate = new Date(dueStartDate);
    postDueReminderDate.setDate(
      postDueReminderDate.getDate() + requirementReminder,
    );

    // Deduct one day from end of cycle except for ONE TIME to prevent overlap with next cycle's start date
    if (renewalTypeId !== 1) {
      dueEndDate = this.commonUtilitiesService.deductDaysFromDate(
        dueEndDate,
        1,
      );
    }

    return {
      dueStart: formatDateToString(dueStartDate),
      dueEnd: formatDateToString(dueEndDate),
      preDueReminder: formatDateToString(preDueReminderDate),
      postDueReminder: formatDateToString(postDueReminderDate),
      dueDate: formatDateToString(actualDueDate),
    };
  }

  /**
   * Update warehouse requirement due dates when requirement details change
   * Supports two strategies:
   * - 'allYears': Use dynamic year based on warehouse.created_at (original behavior - updates all)
   * - 'currentOnly': Use passed year parameter, filter by status_id=1 + year match
   * @param requirementId The requirement ID to update dues for
   * @param renewalTypeId New renewal type ID
   * @param requirementStart New requirement start month
   * @param requirementStartDays New requirement start day
   * @param requirementReminder New reminder days
   * @param requirementDueDays New due days
   * @param year Year parameter (used for calculation in currentOnly strategy)
   * @param updateStrategy 'allYears' | 'currentOnly' (default: 'allYears')
   */
  async updateDuesForRequirement(
    requirementId: number,
    renewalTypeId: number,
    requirementStart: number,
    requirementStartDays: number,
    requirementReminder: number,
    requirementDueDays: number,
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

        // Calculate dates using passed year
        const newDates = this.calculateDueDates(
          renewalTypeId,
          requirementStart,
          requirementStartDays,
          requirementReminder,
          requirementDueDays,
          year,
        );

        const result = await this.warehouseRequirementDuesRepository
          .createQueryBuilder()
          .update(WarehouseRequirementDue)
          .set({
            warehouse_requirement_due_start: newDates.dueStart,
            warehouse_requirement_due_end: newDates.dueEnd,
            warehouse_requirement_due_pre_reminder_date:
              newDates.preDueReminder,
            warehouse_requirement_due_post_reminder_date:
              newDates.postDueReminder,
            warehouse_requirement_due_date: newDates.dueDate,
          })
          .where("warehouse_requirement_id IN (:...warehouseRequirementIds)", {
            warehouseRequirementIds,
          })
          .andWhere("status_id = 1")
          .andWhere(
            "warehouse_requirement_due_start BETWEEN :yearStart AND :yearEnd",
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

          // Calculate new due dates using effectiveYear
          const newDates = this.calculateDueDates(
            renewalTypeId,
            requirementStart,
            requirementStartDays,
            requirementReminder,
            requirementDueDays,
            effectiveYear,
          );

          // Update all dues for this warehouse requirement
          const result = await this.warehouseRequirementDuesRepository.update(
            { warehouse_requirement_id: wr.id },
            {
              warehouse_requirement_due_start: newDates.dueStart,
              warehouse_requirement_due_end: newDates.dueEnd,
              warehouse_requirement_due_pre_reminder_date:
                newDates.preDueReminder,
              warehouse_requirement_due_post_reminder_date:
                newDates.postDueReminder,
              warehouse_requirement_due_date: newDates.dueDate,
            },
          );

          totalUpdated += result.affected || 0;
        }
      }

      return { updated: totalUpdated };
    } catch (error) {
      logger.error(
        `Error updating dues for requirement ${requirementId}:`,
        error,
      );
      throw error;
    }
  }
}
