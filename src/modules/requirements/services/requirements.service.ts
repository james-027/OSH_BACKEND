import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { RequirementRemindersService } from "./requirement-reminders.service";
import { WarehouseRequirementStartsService } from "../../warehouse-requirements/services/warehouse-requirement-starts.service";
import { WarehouseRequirementDuesService } from "../../warehouse-requirements/services/warehouse-requirement-dues.service";

import { Requirement } from "src/entities/Requirement";
import { CreateRequirementDto } from "src/modules/requirements/dto/CreateRequirementDto";
import { UpdateRequirementDto } from "src/modules/requirements/dto/UpdateRequirementDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

@Injectable()
export class RequirementsService {
  constructor(
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private requirementRemindersService: RequirementRemindersService,
    @Inject(forwardRef(() => WarehouseRequirementStartsService))
    private warehouseRequirementStartsService: WarehouseRequirementStartsService,
    @Inject(forwardRef(() => WarehouseRequirementDuesService))
    private warehouseRequirementDuesService: WarehouseRequirementDuesService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  private getDataRepoRelations(): string[] {
    return [
      "status",
      "createdBy",
      "updatedBy",
      "renewalType",
      "requirementType",
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
    userId: number,
  ): Promise<any> {
    try {
      // Check if requirement with this name already exists
      const existingRequirement = await this.requirementsRepository.findOne({
        where: { requirement_name: createRequirementDto.requirement_name },
      });

      if (existingRequirement) {
        throw new BadRequestException(
          "Requirement with this name already exists",
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
        userId,
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
        userId,
      );

      const requirementWithRelations =
        await this.requirementsRepository.findOne({
          where: { id: savedRequirement.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementWithRelations) {
        throw new Error("Failed to retrieve created requirement");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        requirementWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("requirements", response.id, response);
        this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        await this.cacheInvalidationService.invalidateRequirements();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
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
    userId: number,
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
            "Requirement with this name already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Store old values for date-related fields to check if they changed
      const oldDateValues = {
        requirement_reminder: requirement.requirement_reminder,
        requirement_start: requirement.requirement_start,
        requirement_start_days: requirement.requirement_start_days,
        requirement_due_days: requirement.requirement_due_days,
        renewal_type_id: requirement.renewal_type_id,
      };

      // Check if any date values actually changed (not just present in DTO)
      const hasDateChanges =
        (updateRequirementDto.requirement_reminder !== undefined &&
          updateRequirementDto.requirement_reminder !==
            oldDateValues.requirement_reminder) ||
        (updateRequirementDto.requirement_start !== undefined &&
          updateRequirementDto.requirement_start !==
            oldDateValues.requirement_start) ||
        (updateRequirementDto.requirement_start_days !== undefined &&
          updateRequirementDto.requirement_start_days !==
            oldDateValues.requirement_start_days) ||
        (updateRequirementDto.requirement_due_days !== undefined &&
          updateRequirementDto.requirement_due_days !==
            oldDateValues.requirement_due_days) ||
        (updateRequirementDto.renewal_type_id !== undefined &&
          updateRequirementDto.renewal_type_id !==
            oldDateValues.renewal_type_id);

      const shouldUpdateWarehouseDates =
        updateRequirementDto.update_date_details === true && hasDateChanges;

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
        userId,
      );

      // Update warehouse requirement dates if needed
      if (shouldUpdateWarehouseDates) {
        const newValues = {
          renewal_type_id:
            updateRequirementDto.renewal_type_id ??
            oldDateValues.renewal_type_id,
          requirement_start:
            updateRequirementDto.requirement_start ??
            oldDateValues.requirement_start,
          requirement_start_days:
            updateRequirementDto.requirement_start_days ??
            oldDateValues.requirement_start_days,
          requirement_reminder:
            updateRequirementDto.requirement_reminder ??
            oldDateValues.requirement_reminder,
          requirement_due_days:
            updateRequirementDto.requirement_due_days ??
            oldDateValues.requirement_due_days,
        };

        try {
          const year = updateRequirementDto.year ?? new Date().getFullYear();
          // const updateStrategy =
          //   updateRequirementDto.update_strategy ?? "allYears";
          const updateStrategy = "currentOnly";

          // Update warehouse requirement starts
          await this.warehouseRequirementStartsService.updateStartsForRequirement(
            requirement.id,
            newValues.renewal_type_id,
            newValues.requirement_start,
            newValues.requirement_start_days,
            year,
            updateStrategy,
          );

          // Update warehouse requirement dues
          await this.warehouseRequirementDuesService.updateDuesForRequirement(
            requirement.id,
            newValues.renewal_type_id,
            newValues.requirement_start,
            newValues.requirement_start_days,
            newValues.requirement_reminder,
            newValues.requirement_due_days,
            year,
            updateStrategy,
          );

          logger.info(
            `Updated warehouse requirement dates for requirement ${requirement.id}`,
          );
        } catch (warehouseError) {
          logger.error(
            `Error updating warehouse requirement dates for requirement ${requirement.id}:`,
            warehouseError,
          );
          // Don't throw - warehouse date update failure shouldn't fail the entire requirement update
          // Log the error for audit purposes
        }
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementsService",
          method: "update",
          raw_data: JSON.stringify(requirement),
          description: `Updated requirement ${requirement.id} - ${requirement.requirement_name}`,
          status_id: 1,
        },
        userId,
      );

      const requirementWithRelations =
        await this.requirementsRepository.findOne({
          where: { id: requirement.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementWithRelations) {
        throw new Error("Failed to retrieve created requirement");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        requirementWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("requirements", response.id, response);
        this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        await this.cacheInvalidationService.invalidateRequirements();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
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
        userId,
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
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedRequirement);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("requirements", response.id, response);
        this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        await this.cacheInvalidationService.invalidateRequirements();
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
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
