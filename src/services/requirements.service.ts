import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { RequirementRemindersService } from "./requirement-reminders.service";

import { Requirement } from "src/entities/Requirement";
import { CreateRequirementDto } from "src/dto/CreateRequirementDto";
import { UpdateRequirementDto } from "src/dto/UpdateRequirementDto";
import { ResponseMapperService } from "./response-mapper.service";

@Injectable()
export class RequirementsService {
  constructor(
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private requirementRemindersService: RequirementRemindersService
  ) {}

  private getDataRepoRelations(): string[] {
    return [
      "status",
      "createdBy",
      "updatedBy",
      "renewalType",
      "requirementReminders",
      "requirementReminders.reminderType",
      "requirementReminders.status",
    ];
  }

  async findAll(): Promise<any[]> {
    try {
      const requirements = await this.requirementsRepository.find({
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
      const requirement = await this.requirementsRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!requirement) {
        throw new NotFoundException(`Requirement with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(requirement);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching requirements:", error);
      throw new Error("Failed to fetch requirements");
    }
  }

  async create(
    createRequirementDto: CreateRequirementDto,
    userId: number
  ): Promise<any> {
    try {
      // Check if requirement with this name already exists
      const existingRequirement = await this.requirementsRepository.findOne({
        where: { requirement_name: createRequirementDto.requirement_name },
      });

      if (existingRequirement) {
        throw new BadRequestException(
          "Requirement with this name already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRequirement = this.requirementsRepository.create({
        ...createRequirementDto,
        requirement_name: createRequirementDto.requirement_name.toUpperCase(),
        requirement_abbr_name:
          createRequirementDto.requirement_abbr_name.toUpperCase(),
        status_id: createRequirementDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRequirement =
        await this.requirementsRepository.save(newRequirement);

      // Save requirement reminders (dynamic reminder_type_X fields)
      await this.requirementRemindersService.createOrUpdateBulk(
        savedRequirement.id,
        createRequirementDto,
        userId
      );

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementsService",
          method: "create",
          raw_data: JSON.stringify(savedRequirement),
          description: `Created requirement ${savedRequirement.id} - ${savedRequirement.requirement_name}`,
          status_id: 1,
        },
        userId
      );

      const requirementWithRelations =
        await this.requirementsRepository.findOne({
          where: { id: savedRequirement.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementWithRelations) {
        throw new Error("Failed to retrieve created requirement");
      }

      return this.responseMapperService.mapEntityToResponse(
        requirementWithRelations
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create requirement");
    }
  }

  async update(
    id: number,
    updateRequirementDto: UpdateRequirementDto,
    userId: number
  ): Promise<any> {
    try {
      const requirement = await this.requirementsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!requirement) {
        throw new NotFoundException(`Requirement with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateRequirementDto.requirement_name) {
        const whereConditions = [];
        if (updateRequirementDto.requirement_name) {
          whereConditions.push({
            requirement_name: updateRequirementDto.requirement_name,
          });
        }

        const existingRequirement = await this.requirementsRepository.findOne({
          where: whereConditions,
        });

        if (existingRequirement && existingRequirement.id !== id) {
          throw new BadRequestException(
            "Requirement with this name already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateRequirementDto.requirement_name) {
        updateRequirementDto.requirement_name =
          updateRequirementDto.requirement_name.toUpperCase();
      }

      if (updateRequirementDto.requirement_abbr_name) {
        updateRequirementDto.requirement_abbr_name =
          updateRequirementDto.requirement_abbr_name.toUpperCase();
      }

      Object.assign(requirement, updateRequirementDto, {
        updated_by: userId,
      });

      await this.requirementsRepository.save(requirement);

      // Update requirement reminders (dynamic reminder_type_X fields)
      await this.requirementRemindersService.createOrUpdateBulk(
        requirement.id,
        updateRequirementDto,
        userId
      );

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementsService",
          method: "update",
          raw_data: JSON.stringify(requirement),
          description: `Updated requirement ${requirement.id} - ${requirement.requirement_name}`,
          status_id: 1,
        },
        userId
      );

      const requirementWithRelations =
        await this.requirementsRepository.findOne({
          where: { id: requirement.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementWithRelations) {
        throw new Error("Failed to retrieve created requirement");
      }

      return this.responseMapperService.mapEntityToResponse(
        requirementWithRelations
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to create requirement");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const requirement = await this.requirementsRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!requirement) {
        throw new NotFoundException(`Requirement with ID ${id} not found`);
      }

      const newStatusId = requirement.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.requirementsRepository.update(id, {
        status_id: newStatusId,
      });

      // Toggle status for all requirement reminders
      await this.requirementRemindersService.toggleStatusByRequirementId(
        id,
        newStatusId,
        userId
      );

      const updatedRequirement = await this.requirementsRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });
      if (!updatedRequirement) {
        throw new Error("Failed to retrieve updated requirement");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRequirement),
          description: `Toggled status for requirement ${id} - ${requirement.requirement_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId
      );

      return this.responseMapperService.mapEntityToResponse(updatedRequirement);
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
