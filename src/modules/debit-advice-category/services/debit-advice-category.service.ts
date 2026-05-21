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
import { User } from "src/entities/User";
import { Status } from "src/entities/Status";

@Injectable()
export class DebitAdviceCategoryService {
  constructor(
    @InjectRepository(DebitAdviceCategory)
    private debitAdviceCategoryRepository: Repository<DebitAdviceCategory>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) { }

  

  // Get all debit advice categories
  async findAll(): Promise<any[]> {
    try {
      const debitAdviceCategories =
        await this.debitAdviceCategoryRepository.find({
          relations: ["status"],
        })

      return debitAdviceCategories.map((debitAdviceCategory) => ({
        id: debitAdviceCategory.id,
        category_code: debitAdviceCategory.category_code,
        category_name: debitAdviceCategory.category_name,
        old_code: debitAdviceCategory.old_code,
        company: debitAdviceCategory.company,
        status_id: debitAdviceCategory.status_id,
        status_name:
        debitAdviceCategory.status
          ? debitAdviceCategory.status.status_name
          : null,
        created_at: debitAdviceCategory.created_at,
        updated_at: debitAdviceCategory.updated_at,
        created_by: debitAdviceCategory.created_by,
      }));
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
        relations: ["status"],
      })

      if (!debitAdviceCategory) {
        throw new NotFoundException(
          `Debit advice category with ID ${id} not found`,
        );
      }

      return {
        id: debitAdviceCategory.id,
        category_code: debitAdviceCategory.category_code,
        category_name: debitAdviceCategory.category_name,
        old_code: debitAdviceCategory.old_code,
        company: debitAdviceCategory.company,
        status_id: debitAdviceCategory.status_id,
       status_name:
        debitAdviceCategory.status
          ? debitAdviceCategory.status.status_name
          : null,
        created_at: debitAdviceCategory.created_at,
        updated_at: debitAdviceCategory.updated_at,
        created_by: debitAdviceCategory.created_by,
      };
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
    const {  status_id } = createDebitAdviceCategoryDto;
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
        this.sseEventEmitter.emitCreateSignal(
          "debit-advice-category",
          savedDebitAdviceCategory.id,
        );
      } catch (err) {
        logger.error("SSE create event failed:", err);
      }
    const resolvedStatusId = status_id || 1;
    const statusEntity = await this.statusRepository.findOneBy({
      id: resolvedStatusId,
    });
    if (!statusEntity) {
      throw new BadRequestException(
        `Status with ID ${resolvedStatusId} not found.`,
      );
    }
      return {
        id: savedDebitAdviceCategory.id,
        category_code: savedDebitAdviceCategory.category_code,
        category_name: savedDebitAdviceCategory.category_name,
        old_code: savedDebitAdviceCategory.old_code,
        company: savedDebitAdviceCategory.company,
        status_id: savedDebitAdviceCategory.status_id,
        status_name:
        savedDebitAdviceCategory.status
          ? savedDebitAdviceCategory.status.status_name
          : null,
        created_at: savedDebitAdviceCategory.created_at,
        updated_at: savedDebitAdviceCategory.updated_at,
        created_by: savedDebitAdviceCategory.created_by,
      };

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

      await this.debitAdviceCategoryRepository.save(
        debitAdviceCategory,
      );

      const updatedDebitAdviceCategory =
        await this.debitAdviceCategoryRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      if (!updatedDebitAdviceCategory) {
        throw new Error(
          "Failed to retrieve updated debit advice category",
        );
      }

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
        this.sseEventEmitter.emitUpdateSignal(
          "debit-advice-category",
          updatedDebitAdviceCategory.id,
        );
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

      return {
        id: updatedDebitAdviceCategory.id,
        category_code: updatedDebitAdviceCategory.category_code,
        category_name: updatedDebitAdviceCategory.category_name,
        old_code: updatedDebitAdviceCategory.old_code,
        company: updatedDebitAdviceCategory.company,
        status_id: updatedDebitAdviceCategory.status_id,
       status_name:
       updatedDebitAdviceCategory.status
        ? updatedDebitAdviceCategory.status.status_name
        : null,
        created_at: updatedDebitAdviceCategory.created_at,
        updated_at: updatedDebitAdviceCategory.updated_at,
        created_by: updatedDebitAdviceCategory.created_by,
      };
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

      debitAdviceCategory.status_id = 14;

      await this.debitAdviceCategoryRepository.save(
        debitAdviceCategory,
      );

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
        this.sseEventEmitter.emitDeleteSignal(
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

  async toggleStatus(id: number, userId: number) {
    const debitAdviceCategoryToUpdate =
      await this.debitAdviceCategoryRepository.findOne({
        where: { id },
      });

    if (!debitAdviceCategoryToUpdate) {
      throw new NotFoundException(
        "Debit advice category not found for status toggle.",
      );
    }

    // Determine new status_id
    let newStatusId: number;

    if (debitAdviceCategoryToUpdate.status_id === 1) {
      newStatusId = 14; // Set to deleted
    } else {
      newStatusId = 1; // Set to active
    }

   const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });
    if (!newStatusEntity) {
      throw new Error(
        "Target status (active/delete) not found in the database.",
      );
    }
    debitAdviceCategoryToUpdate.status =
    newStatusEntity;

    debitAdviceCategoryToUpdate.status_id =
      newStatusEntity.id;

    const updatedDebitAdviceCategory =
      await this.debitAdviceCategoryRepository.save(
        debitAdviceCategoryToUpdate,
      );

    // Audit trail
    try {
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_CATEGORY",
          method: "TOGGLE_STATUS",
          raw_data: JSON.stringify(updatedDebitAdviceCategory),
          description: `Toggled debit advice category: ${updatedDebitAdviceCategory.category_code}`,
          status_id: updatedDebitAdviceCategory.status_id,
        },
        userId,
      );
    } catch (auditError) {
      logger.error("AUDIT ERROR", auditError);
    }

    // SSE UPDATE
    try {
     this.sseEventEmitter.emitUpdateSignal(
      "debit-advice-category",
      updatedDebitAdviceCategory.id,
    );
    } catch (err) {
      logger.error("SSE toggle event failed:", err);
    }

    return {
      message: `Debit advice category ${updatedDebitAdviceCategory.category_code} successfully toggled ${newStatusId === 1 ? "to active" : "to deleted"
        }.`,
      debit_advice_category: {
        ...updatedDebitAdviceCategory,
       status_name:
        updatedDebitAdviceCategory.status
          ? updatedDebitAdviceCategory.status.status_name
          : null,
      },
    };
  }
}