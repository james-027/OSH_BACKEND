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
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class DebitAdviceCategoryService {
  constructor(
    @InjectRepository(DebitAdviceCategory)
    private debitAdviceCategoryRepository: Repository<DebitAdviceCategory>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) { }

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
              createDebitAdviceCategoryDto.category_code,
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
            createDebitAdviceCategoryDto.category_code,

          category_name:
            createDebitAdviceCategoryDto.category_name || null,

          old_code:
            createDebitAdviceCategoryDto.old_code || null,

          company:
            createDebitAdviceCategoryDto.company || null,

          created_by: userId,
        });

      const savedDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.save(
          newDebitAdviceCategory,
        );

      // Audit trail
      try {
        await this.userAuditTrailCreateService.create(
          {
            service: "DEBIT_ADVICE_CATEGORY",
            method: "CREATE",
            raw_data: JSON.stringify(savedDebitAdviceCategory),
            description: `Created debit advice category: ${savedDebitAdviceCategory.category_code}`,
            status_id: 1,
          },
          userId,
        );
      } catch (auditError) {
        logger.error("AUDIT ERROR", auditError);
      }

      // SSE CREATE
      try {
        this.sseEventEmitter.emitCreate(
          "debit-advice-category",
          savedDebitAdviceCategory.id,
        );
      } catch (err) {
        logger.error("SSE create event failed:", err);
      }

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
        updateDebitAdviceCategoryDto.category_code !==
        debitAdviceCategory.category_code
      ) {
        const existingDebitAdviceCategory =
          await this.debitAdviceCategoryRepository.findOne({
            where: {
              category_code:
                updateDebitAdviceCategoryDto.category_code,
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
        updateDebitAdviceCategoryDto.category_code ||
        debitAdviceCategory.category_code;

      debitAdviceCategory.category_name =
        updateDebitAdviceCategoryDto.category_name ||
        debitAdviceCategory.category_name;

      debitAdviceCategory.old_code =
        updateDebitAdviceCategoryDto.old_code ||
        debitAdviceCategory.old_code;

      debitAdviceCategory.company =
        updateDebitAdviceCategoryDto.company ||
        debitAdviceCategory.company;

      const updatedDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.save(
          debitAdviceCategory,
        );

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_CATEGORY",
          method: "EDIT",
          raw_data: JSON.stringify(updatedDebitAdviceCategory),
          description: `Updated debit advice category: ${updatedDebitAdviceCategory.category_code}`,
          status_id: updatedDebitAdviceCategory.status_id || 1,
        },
        userId,
      );

      // SSE UPDATE
      try {
        this.sseEventEmitter.emitUpdate(
          "debit-advice-category",
          updatedDebitAdviceCategory.id,
        );
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

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

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_CATEGORY",
          method: "DELETE",
          raw_data: JSON.stringify(debitAdviceCategory),
          description: `Deleted debit advice category: ${debitAdviceCategory.category_code}`,
          status_id: 14,
        },
        userId,
      );

      // SSE DELETE
      try {
        this.sseEventEmitter.emitDelete(
          "debit-advice-category",
          id,
        );
      } catch (err) {
        logger.error("SSE delete event failed:", err);
      }

    } catch (error) {
      logger.error(
        "Error deleting debit advice category:",
        error,
      );

      throw error;
    }
  }
}