import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { ReminderType } from "src/entities/ReminderType";
import { CreateReminderTypeDto } from "src/dto/CreateReminderTypeDto";
import { UpdateReminderTypeDto } from "src/dto/UpdateReminderTypeDto";
import { ResponseMapperService } from "./response-mapper.service";

@Injectable()
export class ReminderTypesService {
  constructor(
    @InjectRepository(ReminderType)
    private reminderTypesRepository: Repository<ReminderType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const reminderTypes = await this.reminderTypesRepository.find({
        relations: ["status", "createdBy", "updatedBy"],
      });

      return this.responseMapperService.mapEntitiesToResponse(reminderTypes);
    } catch (error) {
      console.error("Error fetching reminder types:", error);
      throw new Error("Failed to fetch reminder types");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const reminderType = await this.reminderTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!reminderType) {
        throw new NotFoundException(`ReminderType with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(reminderType);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching reminder types:", error);
      throw new Error("Failed to fetch reminder types");
    }
  }

  async create(
    createReminderTypeDto: CreateReminderTypeDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if reminder type with this name already exists
      const existingReminderType = await this.reminderTypesRepository.findOne({
        where: { reminder_type_name: createReminderTypeDto.reminder_type_name },
      });

      if (existingReminderType) {
        throw new BadRequestException(
          "Reminder Type with this name already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newReminderType = this.reminderTypesRepository.create({
        reminder_type_name:
          createReminderTypeDto.reminder_type_name.toUpperCase(),
        status_id: createReminderTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedReminderType =
        await this.reminderTypesRepository.save(newReminderType);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReminderTypesService",
          method: "create",
          raw_data: JSON.stringify(savedReminderType),
          description: `Created reminder type ${savedReminderType.id} - ${savedReminderType.reminder_type_name}`,
          status_id: 1,
        },
        userId
      );

      const reminderTypeWithRelations =
        await this.reminderTypesRepository.findOne({
          where: { id: savedReminderType.id },
          relations: ["status", "createdBy", "updatedBy"],
        });

      if (!reminderTypeWithRelations) {
        throw new Error("Failed to retrieve created reminder type");
      }

      return this.responseMapperService.mapEntityToResponse(
        reminderTypeWithRelations
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create reminder type");
    }
  }

  async update(
    id: number,
    updateReminderTypeDto: UpdateReminderTypeDto,
    userId: number
  ): Promise<any> {
    try {
      const reminderType = await this.reminderTypesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!reminderType) {
        throw new NotFoundException(`Reminder Type with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateReminderTypeDto.reminder_type_name) {
        const whereConditions = [];
        if (updateReminderTypeDto.reminder_type_name) {
          whereConditions.push({
            reminder_type_name: updateReminderTypeDto.reminder_type_name,
          });
        }

        const existingReminderType = await this.reminderTypesRepository.findOne(
          {
            where: whereConditions,
          }
        );

        if (existingReminderType && existingReminderType.id !== id) {
          throw new BadRequestException(
            "Reminder Type with this name already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateReminderTypeDto.reminder_type_name) {
        updateReminderTypeDto.reminder_type_name =
          updateReminderTypeDto.reminder_type_name.toUpperCase();
      }
      Object.assign(reminderType, updateReminderTypeDto, {
        updated_by: userId,
      });

      await this.reminderTypesRepository.save(reminderType);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReminderTypesService",
          method: "update",
          raw_data: JSON.stringify(reminderType),
          description: `Updated reminder type ${reminderType.id} - ${reminderType.reminder_type_name}`,
          status_id: 1,
        },
        userId
      );

      const reminderTypeWithRelations =
        await this.reminderTypesRepository.findOne({
          where: { id: reminderType.id },
          relations: ["status", "createdBy", "updatedBy"],
        });

      if (!reminderTypeWithRelations) {
        throw new Error("Failed to retrieve created reminder type");
      }

      return this.responseMapperService.mapEntityToResponse(
        reminderTypeWithRelations
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to create reminder type");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const reminderType = await this.reminderTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!reminderType) {
        throw new NotFoundException(`Reminder Type with ID ${id} not found`);
      }

      const newStatusId = reminderType.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.reminderTypesRepository.update(id, {
        status_id: newStatusId,
      });
      const updatedReminderType = await this.reminderTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });
      if (!updatedReminderType) {
        throw new Error("Failed to retrieve updated reminder type");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReminderTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedReminderType),
          description: `Toggled status for reminder type ${id} - ${reminderType.reminder_type_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId
      );

      return this.responseMapperService.mapEntityToResponse(
        updatedReminderType
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to toggle status for company");
    }
  }
}
