import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { CategoryType } from "src/entities/CategoryType";
import { CreateCategoryTypeDto } from "src/dto/CreateCategoryTypeDto";
import { UpdateCategoryTypeDto } from "src/dto/UpdateCategoryTypeDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";

@Injectable()
export class CategoryTypesService {
  constructor(
    @InjectRepository(CategoryType)
    private categoryTypesRepository: Repository<CategoryType>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const categoryTypes = await this.categoryTypesRepository.find({
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      return this.responseMapperService.mapEntitiesToResponse(categoryTypes);
    } catch (error) {
      console.error("Error fetching category types:", error);
      throw new Error("Failed to fetch category types");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const categoryType = await this.categoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!categoryType) {
        throw new NotFoundException(`CategoryType with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(categoryType);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching category types:", error);
      throw new Error("Failed to fetch category types");
    }
  }

  async create(
    createCategoryTypeDto: CreateCategoryTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if category type with this name already exists
      const existingCategoryType = await this.categoryTypesRepository.findOne({
        where: {
          category_type_name: createCategoryTypeDto.category_type_name,
        },
      });

      if (existingCategoryType) {
        throw new BadRequestException(
          "Category Type with this name already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newCategoryType = this.categoryTypesRepository.create({
        category_type_name:
          createCategoryTypeDto.category_type_name.toUpperCase(),
        category_id: createCategoryTypeDto.category_id,
        status_id: createCategoryTypeDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedCategoryType =
        await this.categoryTypesRepository.save(newCategoryType);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoryTypesService",
          method: "create",
          raw_data: JSON.stringify(savedCategoryType),
          description: `Created category type ${savedCategoryType.id} - ${savedCategoryType.category_type_name}`,
          status_id: 1,
        },
        userId,
      );

      const categoryTypeWithRelations =
        await this.categoryTypesRepository.findOne({
          where: { id: savedCategoryType.id },
          relations: ["status", "createdBy", "updatedBy", "category"],
        });

      if (!categoryTypeWithRelations) {
        throw new Error("Failed to retrieve created category type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        categoryTypeWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate(
          "category_types",
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
      throw new Error("Failed to create category type");
    }
  }

  async update(
    id: number,
    updateCategoryTypeDto: UpdateCategoryTypeDto,
    userId: number,
  ): Promise<any> {
    try {
      const categoryType = await this.categoryTypesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!categoryType) {
        throw new NotFoundException(`CategoryType with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateCategoryTypeDto.category_type_name) {
        const whereConditions = [];
        if (updateCategoryTypeDto.category_type_name) {
          whereConditions.push({
            category_type_name: updateCategoryTypeDto.category_type_name,
          });
        }

        const existingCategoryType = await this.categoryTypesRepository.findOne(
          {
            where: whereConditions,
          },
        );

        if (existingCategoryType && existingCategoryType.id !== id) {
          throw new BadRequestException(
            "Category Type with this name already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateCategoryTypeDto.category_type_name) {
        updateCategoryTypeDto.category_type_name =
          updateCategoryTypeDto.category_type_name.toUpperCase();
      }

      Object.assign(categoryType, updateCategoryTypeDto, {
        updated_by: userId,
      });

      await this.categoryTypesRepository.save(categoryType);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoryTypesService",
          method: "update",
          raw_data: JSON.stringify(categoryType),
          description: `Updated category type ${categoryType.id} - ${categoryType.category_type_name}`,
          status_id: 1,
        },
        userId,
      );

      const categoryTypeWithRelations =
        await this.categoryTypesRepository.findOne({
          where: { id: categoryType.id },
          relations: ["status", "createdBy", "updatedBy", "category"],
        });

      if (!categoryTypeWithRelations) {
        throw new Error("Failed to retrieve updated category type");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        categoryTypeWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "category_types",
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
      throw new Error("Failed to update category type");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const categoryType = await this.categoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!categoryType) {
        throw new NotFoundException(`CategoryType with ID ${id} not found`);
      }

      const newStatusId = categoryType.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.categoryTypesRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedCategoryType = await this.categoryTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "category"],
      });

      if (!updatedCategoryType) {
        throw new Error("Failed to retrieve updated category type");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoryTypesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedCategoryType),
          description: `Toggled status for category type ${id} - ${categoryType.category_type_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedCategoryType);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate(
          "category_types",
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
      throw new Error("Failed to toggle status for category type");
    }
  }
}
