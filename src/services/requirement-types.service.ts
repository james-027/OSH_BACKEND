import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { RequirementType } from "src/entities/RequirementType";
import { CreateRequirementTypeDto } from "src/dto/CreateRequirementTypeDto";
import { UpdateRequirementTypeDto } from "src/dto/UpdateRequirementTypeDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";

@Injectable()
export class RequirementTypesService {
  constructor(
    @InjectRepository(RequirementType)
    private requirementTypesRepository: Repository<RequirementType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  private getDataRepoRelations(): string[] {
    return ["status", "createdBy", "updatedBy"];
  }

  async findAll(): Promise<any[]> {
    try {
      const requirementTypes = await this.requirementTypesRepository.find({
        relations: this.getDataRepoRelations(),
      });

      return this.responseMapperService.mapEntitiesToResponse(requirementTypes);
    } catch (error) {
      console.error("Error fetching requirement types:", error);
      throw new Error("Failed to fetch requirement types");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const requirementType = await this.requirementTypesRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!requirementType) {
        throw new NotFoundException(`RequirementType with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(requirementType);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching requirement types:", error);
      throw new Error("Failed to fetch requirement types");
    }
  }

  async create(
    createRequirementTypeDto: CreateRequirementTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if requirement type with this name already exists
      const existingRequirementType =
        await this.requirementTypesRepository.findOne({
          where: {
            requirement_type_name:
              createRequirementTypeDto.requirement_type_name,
          },
        });

      if (existingRequirementType) {
        throw new BadRequestException(
          "Requirement Type with this name already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRequirementType = this.requirementTypesRepository.create({
        requirement_type_name:
          createRequirementTypeDto.requirement_type_name.toUpperCase(),
        status_id: createRequirementTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedRequirementType =
        await this.requirementTypesRepository.save(newRequirementType);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementTypesService",
          method: "create",
          raw_data: JSON.stringify(savedRequirementType),
          description: `Created requirement type ${savedRequirementType.id} - ${savedRequirementType.requirement_type_name}`,
          status_id: 1,
        },
        userId,
      );

      const requirementTypeWithRelations =
        await this.requirementTypesRepository.findOne({
          where: { id: savedRequirementType.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementTypeWithRelations) {
        throw new Error("Failed to retrieve created requirement type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        requirementTypeWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "requirement_types",
          response.id,
          response,
        );
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create requirement type");
    }
  }

  async update(
    id: number,
    updateRequirementTypeDto: UpdateRequirementTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      const requirementType = await this.requirementTypesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!requirementType) {
        throw new NotFoundException(`Requirement Type with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateRequirementTypeDto.requirement_type_name) {
        const whereConditions = [];
        if (updateRequirementTypeDto.requirement_type_name) {
          whereConditions.push({
            requirement_type_name:
              updateRequirementTypeDto.requirement_type_name,
          });
        }

        const existingRequirementType =
          await this.requirementTypesRepository.findOne({
            where: whereConditions,
          });

        if (existingRequirementType && existingRequirementType.id !== id) {
          throw new BadRequestException(
            "Requirement Type with this name already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateRequirementTypeDto.requirement_type_name) {
        updateRequirementTypeDto.requirement_type_name =
          updateRequirementTypeDto.requirement_type_name.toUpperCase();
      }
      Object.assign(requirementType, updateRequirementTypeDto, {
        updated_by: userId,
      });

      await this.requirementTypesRepository.save(requirementType);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementTypesService",
          method: "update",
          raw_data: JSON.stringify(requirementType),
          description: `Updated requirement type ${requirementType.id} - ${requirementType.requirement_type_name}`,
          status_id: 1,
        },
        userId,
      );

      const requirementTypeWithRelations =
        await this.requirementTypesRepository.findOne({
          where: { id: requirementType.id },
          relations: this.getDataRepoRelations(),
        });

      if (!requirementTypeWithRelations) {
        throw new Error("Failed to retrieve updated requirement type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        requirementTypeWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "requirement_types",
          response.id,
          response,
        );
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
      throw new Error("Failed to update requirement type");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const requirementType = await this.requirementTypesRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!requirementType) {
        throw new NotFoundException(`Requirement Type with ID ${id} not found`);
      }

      const newStatusId = requirementType.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail

      await this.requirementTypesRepository.update(id, {
        status_id: newStatusId,
      });
      const updatedRequirementType =
        await this.requirementTypesRepository.findOne({
          where: { id },
          relations: ["status", "createdBy", "updatedBy"],
        });
      if (!updatedRequirementType) {
        throw new Error("Failed to retrieve updated requirement type");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "RequirementTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedRequirementType),
          description: `Toggled status for requirement type ${id} - ${requirementType.requirement_type_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        updatedRequirementType,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "requirement_types",
          response.id,
          response,
        );
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
      throw new Error("Failed to toggle status for requirement type");
    }
  }
}
