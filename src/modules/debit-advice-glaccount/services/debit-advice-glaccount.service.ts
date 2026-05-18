import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DebitAdviceGlAccount } from "src/entities/DebitAdviceGlAccount";
import { CreateDebitAdviceGlAccountDto } from "../dto/CreateDebitAdviceGlDto";
import { UpdateDebitAdviceGlAccountDto } from "../dto/UpdateDebitAdviceGlDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";

@Injectable()
export class DebitAdviceGlAccountService {
  constructor(
    @InjectRepository(DebitAdviceGlAccount)
    private debitAdviceGlAccountRepository: Repository<DebitAdviceGlAccount>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) { }

  // Get all debit advice GL accounts
  async findAll(): Promise<any[]> {
    try {
      const debitAdviceGlAccounts =
        await this.debitAdviceGlAccountRepository.find({
          where: {
            status_id: 1,
          },
        });

      return debitAdviceGlAccounts;
    } catch (error) {
      console.log("FULL ERROR:", error);
      console.log("ERROR MESSAGE:", error.message);
      console.log("ERROR STACK:", error.stack);

      throw error;
    }
  }

  // Get single debit advice GL account by ID
  async findOne(id: number): Promise<any> {
    try {
      const debitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: { id },
        });

      if (!debitAdviceGlAccount) {
        throw new NotFoundException(
          `Debit advice GL account with ID ${id} not found`,
        );
      }

      return debitAdviceGlAccount;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      logger.error(
        "Error fetching debit advice GL account:",
        error,
      );

      throw new Error(
        "Failed to fetch debit advice GL account",
      );
    }
  }

  // Create new debit advice GL account
  async create(
    createDebitAdviceGlAccountDto: CreateDebitAdviceGlAccountDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check if GL code already exists
      const existingDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: {
            gl_code:
              createDebitAdviceGlAccountDto.gl_code,
          },
        });

      if (existingDebitAdviceGlAccount) {
        throw new BadRequestException(
          "Debit advice GL code already exists",
        );
      }

      // Create debit advice GL account
      const newDebitAdviceGlAccount =
        this.debitAdviceGlAccountRepository.create({
          gl_code:
            createDebitAdviceGlAccountDto.gl_code,

          category_code:
            createDebitAdviceGlAccountDto.category_code ||
            null,

          category_name:
            createDebitAdviceGlAccountDto.category_name ||
            null,

          gl_name:
            createDebitAdviceGlAccountDto.gl_name ||
            null,

          old_code:
            createDebitAdviceGlAccountDto.old_code ||
            null,

          created_by_id: userId,
        });

      const savedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.save(
          newDebitAdviceGlAccount,
        );

      // Audit trail
      try {
        await this.userAuditTrailCreateService.create(
          {
            service: "DEBIT_ADVICE_GL_ACCOUNT",
            method: "CREATE",
            raw_data: JSON.stringify(savedDebitAdviceGlAccount),
            description: `Created debit advice GL account: ${savedDebitAdviceGlAccount.gl_code}`,
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
          "debit-advice-gl-account",
          savedDebitAdviceGlAccount.id,
        );
      } catch (err) {
        logger.error("SSE create event failed:", err);
      }

      return savedDebitAdviceGlAccount;
    } catch (error) {
      logger.error(
        "Error creating debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Update debit advice GL account
  async update(
    id: number,
    updateDebitAdviceGlAccountDto: UpdateDebitAdviceGlAccountDto,
    userId: number,
  ): Promise<any> {
    try {
      const debitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: { id },
        });

      if (!debitAdviceGlAccount) {
        throw new NotFoundException(
          `Debit advice GL account with ID ${id} not found`,
        );
      }

      // Check duplicate gl_code
      if (
        updateDebitAdviceGlAccountDto.gl_code &&
        updateDebitAdviceGlAccountDto.gl_code !==
        debitAdviceGlAccount.gl_code
      ) {
        const existingDebitAdviceGlAccount =
          await this.debitAdviceGlAccountRepository.findOne({
            where: {
              gl_code:
                updateDebitAdviceGlAccountDto.gl_code,
            },
          });

        if (existingDebitAdviceGlAccount) {
          throw new BadRequestException(
            "Debit advice GL code already exists",
          );
        }
      }

      // Update fields
      debitAdviceGlAccount.gl_code =
        updateDebitAdviceGlAccountDto.gl_code ||
        debitAdviceGlAccount.gl_code;

      debitAdviceGlAccount.category_code =
        updateDebitAdviceGlAccountDto.category_code ||
        debitAdviceGlAccount.category_code;

      debitAdviceGlAccount.category_name =
        updateDebitAdviceGlAccountDto.category_name ||
        debitAdviceGlAccount.category_name;

      debitAdviceGlAccount.gl_name =
        updateDebitAdviceGlAccountDto.gl_name ||
        debitAdviceGlAccount.gl_name;

      debitAdviceGlAccount.old_code =
        updateDebitAdviceGlAccountDto.old_code ||
        debitAdviceGlAccount.old_code;

      const updatedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.save(
          debitAdviceGlAccount,
        );

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_GL_ACCOUNT",
          method: "EDIT",
          raw_data: JSON.stringify(updatedDebitAdviceGlAccount),
          description: `Updated debit advice GL account: ${updatedDebitAdviceGlAccount.gl_code}`,
          status_id: updatedDebitAdviceGlAccount.status_id || 1,
        },
        userId,
      );

      // SSE UPDATE
      try {
        this.sseEventEmitter.emitUpdate(
          "debit-advice-gl-account",
          updatedDebitAdviceGlAccount.id,
        );
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

      return updatedDebitAdviceGlAccount;
    } catch (error) {
      logger.error(
        "Error updating debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Delete debit advice GL account
  async delete(
    id: number,
    userId: number,
  ): Promise<void> {
    try {
      const debitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: { id },
        });

      if (!debitAdviceGlAccount) {
        throw new NotFoundException(
          `Debit advice GL account with ID ${id} not found`,
        );
      }

      await this.debitAdviceGlAccountRepository.delete(id);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_GL_ACCOUNT",
          method: "DELETE",
          raw_data: JSON.stringify(debitAdviceGlAccount),
          description: `Deleted debit advice GL account: ${debitAdviceGlAccount.gl_code}`,
          status_id: 14,
        },
        userId,
      );

      // SSE DELETE
      try {
        this.sseEventEmitter.emitDelete(
          "debit-advice-gl-account",
          id,
        );
      } catch (err) {
        logger.error("SSE delete event failed:", err);
      }

    } catch (error) {
      logger.error(
        "Error deleting debit advice GL account:",
        error,
      );

      throw error;
    }
  }
}