import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DebitAdviceCategory } from "src/entities/DebitAdviceCategory";
import { CreateDebitAdviceCategoryDto } from "../dto/CreateDebitAdviceCatdto";
import { UpdateDebitAdviceCategoryDto } from "../dto/UpdateDebitAdviceCatDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";

import logger from "../../../config/logger";

@Injectable()
export class DebitAdviceCategoryService {
  constructor(
    @InjectRepository(DebitAdviceCategory)
    private debitAdviceCategoryRepository: Repository<DebitAdviceCategory>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
  ) {}

  // Get all debit advice categories
  async findAll(): Promise<any[]> {
    try {
      const debitAdviceCategories =
        await this.debitAdviceCategoryRepository.find({
          where: {
            status_id: 1,
          },
        });

      return debitAdviceCategories;
    } catch (error) {
      logger.error("Error fetching debit advice categories:", error);
      throw new Error("Failed to fetch debit advice categories");
    }
  }

  // Get single debit advice category by ID
  async findOne(id: number): Promise<any> {
    try {
      const debitAdviceCategory =
        await this.debitAdviceCategoryRepository.findOne({
          where: { id },
        });

      if (!debitAdviceCategory) {
        throw new NotFoundException(
          `Debit advice category with ID ${id} not found`,
        );
      }

      return debitAdviceCategory;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      logger.error("Error fetching debit advice category:", error);
      throw new Error("Failed to fetch debit advice category");
    }
  }

  // Create new debit advice category
  async create(
    createDebitAdviceCategoryDto: CreateDebitAdviceCategoryDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if debit advice category already exists
      const existingDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.findOne({
          where: {
            category_code:
              createDebitAdviceCategoryDto.category_code.toUpperCase(),
          },
        });

      if (existingDebitAdviceCategory) {
        throw new BadRequestException(
          "Debit advice category code already exists",
        );
      }

      // Create debit advice category
      const newDebitAdviceCategory =
        this.debitAdviceCategoryRepository.create({
          category_code:
            createDebitAdviceCategoryDto.category_code.toUpperCase(),

          category_name:
            createDebitAdviceCategoryDto.category_name?.toUpperCase() || null,

          old_code:
            createDebitAdviceCategoryDto.old_code?.toUpperCase() || null,

          company:
            createDebitAdviceCategoryDto.company?.toUpperCase() || null,

          created_by_id: userId,
        });

      const savedDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.save(
          newDebitAdviceCategory,
        );

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "DEBIT_ADVICE_CATEGORY",
      //   action_name: "ADD",
      //   description: `Created debit advice category: ${createDebitAdviceCategoryDto.category_name}`,
      //   method: "create",
      // });

      return savedDebitAdviceCategory;
    } catch (error) {
      logger.error("Error creating debit advice category:", error);
      throw error;
    }
  }

  // Update debit advice category
  async update(
    id: number,
    updateDebitAdviceCategoryDto: UpdateDebitAdviceCategoryDto,
    userId: number,
  ): Promise<any> {
    try {
      const debitAdviceCategory =
        await this.debitAdviceCategoryRepository.findOne({
          where: { id },
        });

      if (!debitAdviceCategory) {
        throw new NotFoundException(
          `Debit advice category with ID ${id} not found`,
        );
      }

      // Check duplicate category_code
      if (
        updateDebitAdviceCategoryDto.category_code &&
        updateDebitAdviceCategoryDto.category_code.toUpperCase() !==
          debitAdviceCategory.category_code
      ) {
        const existingDebitAdviceCategory =
          await this.debitAdviceCategoryRepository.findOne({
            where: {
              category_code:
                updateDebitAdviceCategoryDto.category_code.toUpperCase(),
            },
          });

        if (existingDebitAdviceCategory) {
          throw new BadRequestException(
            "Debit advice category code already exists",
          );
        }
      }

      // Update fields
      debitAdviceCategory.category_code =
        updateDebitAdviceCategoryDto.category_code?.toUpperCase() ||
        debitAdviceCategory.category_code;

      debitAdviceCategory.category_name =
        updateDebitAdviceCategoryDto.category_name?.toUpperCase() ||
        debitAdviceCategory.category_name;

      debitAdviceCategory.old_code =
        updateDebitAdviceCategoryDto.old_code?.toUpperCase() ||
        debitAdviceCategory.old_code;

      debitAdviceCategory.company =
        updateDebitAdviceCategoryDto.company?.toUpperCase() ||
        debitAdviceCategory.company;

      const updatedDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.save(
          debitAdviceCategory,
        );

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "DEBIT_ADVICE_CATEGORY",
      //   action_name: "EDIT",
      //   description: `Updated debit advice category: ${debitAdviceCategory.category_name}`,
      //   method: "update",
      // });

      return updatedDebitAdviceCategory;
    } catch (error) {
      logger.error("Error updating debit advice category:", error);
      throw error;
    }
  }

  // Delete debit advice category
  async delete(
    id: number,
    userId: number,
  ): Promise<void> {
    try {
      const debitAdviceCategory =
        await this.debitAdviceCategoryRepository.findOne({
          where: { id },
        });

      if (!debitAdviceCategory) {
        throw new NotFoundException(
          `Debit advice category with ID ${id} not found`,
        );
      }

      await this.debitAdviceCategoryRepository.delete(id);
    } catch (error) {
      logger.error(
        "Error deleting debit advice category:",
        error,
      );

      throw error;
    }
  }
}