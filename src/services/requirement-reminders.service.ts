import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { RequirementReminder } from "src/entities/RequirementReminder";
import { CreateRequirementReminderDto } from "src/dto/CreateRequirementReminderDto";
import { UpdateRequirementReminderDto } from "src/dto/UpdateRequirementReminderDto";
import { ResponseMapperService } from "./response-mapper.service";

@Injectable()
export class RequirementRemindersService {
  constructor(
    @InjectRepository(RequirementReminder)
    private requirementRemindersRepository: Repository<RequirementReminder>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService
  ) {}

  private getDataRepoRelations(): string[] {
    return ["status", "createdBy", "updatedBy", "renewalType"];
  }

  async findAll(): Promise<any[]> {
    try {
      const requirements = await this.requirementRemindersRepository.find({
        relations: this.getDataRepoRelations(),
      });
      return this.responseMapperService.mapEntitiesToResponse(requirements);
    } catch (error) {
      console.error("Error fetching requirements:", error);
      throw new Error("Failed to fetch requirements");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const requirement_reminder =
        await this.requirementRemindersRepository.findOne({
          where: { id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirement_reminder) {
        throw new NotFoundException(
          `RequirementReminder with ID ${id} not found`
        );
      }

      return this.responseMapperService.mapEntityToResponse(
        requirement_reminder
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching requirements:", error);
      throw new Error("Failed to fetch requirements");
    }
  }

  async create(
    createRequirementReminderDto: CreateRequirementReminderDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if requirement_reminder with this combination already exists
      const existingRequirementReminder =
        await this.requirementRemindersRepository.findOne({
          where: {
            requirement_id: createRequirementReminderDto.requirement_id,
            reminder_type_id: createRequirementReminderDto.reminder_type_id,
          },
        });

      if (existingRequirementReminder) {
        throw new BadRequestException(
          "RequirementReminder with this ID and Reminder Type already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRequirementReminder = this.requirementRemindersRepository.create(
        {
          requirement_id: createRequirementReminderDto.requirement_id,
          reminder_type_id: createRequirementReminderDto.reminder_type_id,
          reminder_count_day: createRequirementReminderDto.reminder_count_day,
          status_id: createRequirementReminderDto.status_id || 1,
          created_by: userId,
          updated_by: userId,
        }
      );

      const savedRequirementReminder =
        await this.requirementRemindersRepository.save(newRequirementReminder);

      return savedRequirementReminder;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create requirement_reminder");
    }
  }

  async createOrUpdateBulk(
    requirementId: number,
    reminderTypesData: Record<string, any>,
    userId: number
  ): Promise<void> {
    try {
      // Extract reminder_type_X fields and their values
      const reminderEntries = Object.entries(reminderTypesData).filter(
        ([key, value]) =>
          key.startsWith("reminder_type_") && typeof value === "number"
      );

      for (const [key, value] of reminderEntries) {
        const reminderTypeId = parseInt(key.split("_")[2]);

        // Check if this reminder already exists
        const existing = await this.requirementRemindersRepository.findOne({
          where: {
            requirement_id: requirementId,
            reminder_type_id: reminderTypeId,
          },
        });

        if (existing) {
          // Update existing
          existing.reminder_count_day = value;
          existing.updated_by = userId;
          await this.requirementRemindersRepository.save(existing);
        } else {
          // Create new
          const newReminder = this.requirementRemindersRepository.create({
            requirement_id: requirementId,
            reminder_type_id: reminderTypeId,
            reminder_count_day: value,
            status_id: 1,
            created_by: userId,
            updated_by: userId,
          });
          await this.requirementRemindersRepository.save(newReminder);
        }
      }
    } catch (error) {
      console.error("Error in createOrUpdateBulk:", error);
      throw new Error("Failed to save requirement reminders");
    }
  }

  async update(
    id: number,
    updateRequirementReminderDto: UpdateRequirementReminderDto,
    userId: number
  ): Promise<any> {
    try {
      const requirement_reminder =
        await this.requirementRemindersRepository.findOne({
          where: { id },
          relations: ["createdBy"],
        });

      if (!requirement_reminder) {
        throw new NotFoundException(
          `RequirementReminder with ID ${id} not found`
        );
      }

      // Check for unique constraints if updating ID
      if (updateRequirementReminderDto.requirement_id) {
        const whereConditions = [];
        if (updateRequirementReminderDto.requirement_id) {
          whereConditions.push({
            requirement_id: updateRequirementReminderDto.requirement_id,
          });
        }
        if (updateRequirementReminderDto.reminder_type_id) {
          whereConditions.push({
            reminder_type_id: updateRequirementReminderDto.reminder_type_id,
          });
        }

        const existingRequirementReminder =
          await this.requirementRemindersRepository.findOne({
            where: whereConditions,
          });

        if (
          existingRequirementReminder &&
          existingRequirementReminder.id !== id
        ) {
          throw new BadRequestException(
            "RequirementReminder with this name and reminder already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(requirement_reminder, updateRequirementReminderDto, {
        updated_by: userId,
      });

      await this.requirementRemindersRepository.save(requirement_reminder);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to create requirement_reminder");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const requirement_reminder =
        await this.requirementRemindersRepository.findOne({
          where: { id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirement_reminder) {
        throw new NotFoundException(
          `RequirementReminder with ID ${id} not found`
        );
      }

      const newStatusId = requirement_reminder.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.requirementRemindersRepository.update(id, {
        status_id: newStatusId,
      });
      const updatedRequirementReminder =
        await this.requirementRemindersRepository.findOne({
          where: { id },
          relations: ["status", "createdBy", "updatedBy"],
        });

      if (!updatedRequirementReminder) {
        throw new Error("Failed to retrieve updated requirement reminder");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementRemindersService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRequirementReminder),
          description: `Toggled status for requirement reminder ${id} to ${newStatusName}`,
          status_id: 1,
        },
        userId
      );

      return this.responseMapperService.mapEntityToResponse(
        updatedRequirementReminder
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to toggle status");
    }
  }

  async toggleStatusByRequirementId(
    requirementId: number,
    newStatusId: number,
    userId: number
  ): Promise<void> {
    try {
      // Find all reminders for this requirement
      const reminders = await this.requirementRemindersRepository.find({
        where: { requirement_id: requirementId },
      });

      if (reminders.length === 0) {
        return; // No reminders to update
      }

      // Update all reminders to the new status
      for (const reminder of reminders) {
        reminder.status_id = newStatusId;
        reminder.updated_by = userId;
        await this.requirementRemindersRepository.save(reminder);
      }

      const statusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementRemindersService",
          method: "toggleStatusByRequirementId",
          raw_data: JSON.stringify({
            requirementId,
            newStatusId,
            count: reminders.length,
          }),
          description: `Toggled status for ${reminders.length} requirement reminders of requirement ${requirementId} to ${statusName}`,
          status_id: 1,
        },
        userId
      );
    } catch (error) {
      console.error("Error toggling requirement reminders status:", error);
      throw new Error("Failed to toggle requirement reminders status");
    }
  }
}
