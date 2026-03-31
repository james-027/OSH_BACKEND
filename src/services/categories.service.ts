import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { Category } from "src/entities/Category";
import { CreateCategoryDto } from "src/dto/CreateCategoryDto";
import { UpdateCategoryDto } from "src/dto/UpdateCategoryDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const categories = await this.categoriesRepository.find({
        relations: ["status", "createdBy", "updatedBy", "categoryTypes"],
      });

      return this.responseMapperService.mapEntitiesToResponse(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw new Error("Failed to fetch categories");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const category = await this.categoriesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "categoryTypes"],
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      return this.responseMapperService.mapEntityToResponse(category);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching categories:", error);
      throw new Error("Failed to fetch categories");
    }
  }

  async create(
    createCategoryDto: CreateCategoryDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if category with this name already exists
      const existingCategory = await this.categoriesRepository.findOne({
        where: { category_name: createCategoryDto.category_name },
      });

      if (existingCategory) {
        throw new BadRequestException("Category with this name already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newCategory = this.categoriesRepository.create({
        category_name: createCategoryDto.category_name.toUpperCase(),
        status_id: createCategoryDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedCategory = await this.categoriesRepository.save(newCategory);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoriesService",
          method: "create",
          raw_data: JSON.stringify(savedCategory),
          description: `Created category ${savedCategory.id} - ${savedCategory.category_name}`,
          status_id: 1,
        },
        userId,
      );

      const categoryWithRelations = await this.categoriesRepository.findOne({
        where: { id: savedCategory.id },
        relations: ["status", "createdBy", "updatedBy", "categoryTypes"],
      });

      if (!categoryWithRelations) {
        throw new Error("Failed to retrieve created category");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        categoryWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("categories", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create category");
    }
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    userId: number,
  ): Promise<any> {
    try {
      const category = await this.categoriesRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateCategoryDto.category_name) {
        const whereConditions = [];
        if (updateCategoryDto.category_name) {
          whereConditions.push({
            category_name: updateCategoryDto.category_name,
          });
        }

        const existingCategory = await this.categoriesRepository.findOne({
          where: whereConditions,
        });

        if (existingCategory && existingCategory.id !== id) {
          throw new BadRequestException(
            "Category with this name already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateCategoryDto.category_name) {
        updateCategoryDto.category_name =
          updateCategoryDto.category_name.toUpperCase();
      }

      Object.assign(category, updateCategoryDto, {
        updated_by: userId,
      });

      await this.categoriesRepository.save(category);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoriesService",
          method: "update",
          raw_data: JSON.stringify(category),
          description: `Updated category ${category.id} - ${category.category_name}`,
          status_id: 1,
        },
        userId,
      );

      const categoryWithRelations = await this.categoriesRepository.findOne({
        where: { id: category.id },
        relations: ["status", "createdBy", "updatedBy", "categoryTypes"],
      });

      if (!categoryWithRelations) {
        throw new Error("Failed to retrieve updated category");
      }

      const response = this.responseMapperService.mapEntityToResponse(
        categoryWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("categories", response.id, response);
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
      throw new Error("Failed to update category");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const category = await this.categoriesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }

      const newStatusId = category.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      await this.categoriesRepository.update(id, {
        status_id: newStatusId,
      });

      const updatedCategory = await this.categoriesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "categoryTypes"],
      });

      if (!updatedCategory) {
        throw new Error("Failed to retrieve updated category");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "CategoriesService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedCategory),
          description: `Toggled status for category ${id} - ${category.category_name} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedCategory);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("categories", response.id, response);
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
      throw new Error("Failed to toggle status for category");
    }
  }
}
