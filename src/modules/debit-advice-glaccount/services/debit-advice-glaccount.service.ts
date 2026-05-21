import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { DebitAdviceGLAccounts } from "src/entities/DebitAdviceGLAccounts";
import { CreateDebitAdviceGlAccountDto } from "../dto/CreateDebitAdviceGlDto";
import { UpdateDebitAdviceGlAccountDto } from "../dto/UpdateDebitAdviceGlDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "../../../config/logger";

import { User } from "src/entities/User";
import { Status } from "src/entities/Status";

@Injectable()
export class DebitAdviceGlAccountService {
  constructor(
    @InjectRepository(DebitAdviceGLAccounts)
    private debitAdviceGlAccountRepository: Repository<DebitAdviceGLAccounts>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,

    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  // Get all GL accounts
  async findAll(): Promise<any[]> {
    try {
      const debitAdviceGlAccounts =
        await this.debitAdviceGlAccountRepository.find({
          relations: ["status"],
        });

      return debitAdviceGlAccounts.map((gl) => ({
        id: gl.id,
        gl_code: gl.gl_code,
        category_code: gl.category_code,
        category_name: gl.category_name,
        gl_name: gl.gl_name,
        old_code: gl.old_code,
        status_id: gl.status_id,
        status_name: gl.status
          ? gl.status.status_name
          : null,
        created_at: gl.created_at,
        updated_at: gl.updated_at,
        created_by: gl.created_by,
      }));
    } catch (error) {
      logger.error(
        "Error fetching debit advice GL accounts:",
        error,
      );

      throw new Error(
        "Failed to fetch debit advice GL accounts",
      );
    }
  }

  // Get single GL account
  async findOne(id: number): Promise<any> {
    try {
      const debitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      if (!debitAdviceGlAccount) {
        throw new NotFoundException(
          `Debit advice GL account with ID ${id} not found`,
        );
      }

      return {
        id: debitAdviceGlAccount.id,
        gl_code: debitAdviceGlAccount.gl_code,
        category_code: debitAdviceGlAccount.category_code,
        category_name: debitAdviceGlAccount.category_name,
        gl_name: debitAdviceGlAccount.gl_name,
        old_code: debitAdviceGlAccount.old_code,
        status_id: debitAdviceGlAccount.status_id,
        status_name: debitAdviceGlAccount.status
          ? debitAdviceGlAccount.status.status_name
          : null,
        created_at: debitAdviceGlAccount.created_at,
        updated_at: debitAdviceGlAccount.updated_at,
        created_by: debitAdviceGlAccount.created_by,
      };
    } catch (error) {
      logger.error(
        "Error fetching debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Create GL account
  async create(
    createDebitAdviceGlAccountDto: CreateDebitAdviceGlAccountDto,
    userId: number,
  ): Promise<any> {
    const { status_id } = createDebitAdviceGlAccountDto;

    try {
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

      const resolvedStatusId = status_id || 1;

      const statusEntity =
        await this.statusRepository.findOneBy({
          id: resolvedStatusId,
        });

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

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

          status_id: resolvedStatusId,
          status: statusEntity,

          created_by: userId,
        });

      const savedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.save(
          newDebitAdviceGlAccount,
        );

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

      this.sseEventEmitter.emitCreateSignal(
        "debit-advice-gl-account",
        savedDebitAdviceGlAccount.id,
      );

      return {
        id: savedDebitAdviceGlAccount.id,
        gl_code: savedDebitAdviceGlAccount.gl_code,
        category_code:
          savedDebitAdviceGlAccount.category_code,
        category_name:
          savedDebitAdviceGlAccount.category_name,
        gl_name: savedDebitAdviceGlAccount.gl_name,
        old_code: savedDebitAdviceGlAccount.old_code,
        status_id: savedDebitAdviceGlAccount.status_id,
        status_name: savedDebitAdviceGlAccount.status
          ? savedDebitAdviceGlAccount.status.status_name
          : null,
        created_at: savedDebitAdviceGlAccount.created_at,
        updated_at: savedDebitAdviceGlAccount.updated_at,
        created_by: savedDebitAdviceGlAccount.created_by,
      };
    } catch (error) {
      logger.error(
        "Error creating debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Update GL account
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

      if (
        updateDebitAdviceGlAccountDto.gl_code &&
        updateDebitAdviceGlAccountDto.gl_code !==
          debitAdviceGlAccount.gl_code
      ) {
        const existing =
          await this.debitAdviceGlAccountRepository.findOne({
            where: {
              gl_code:
                updateDebitAdviceGlAccountDto.gl_code,
            },
          });

        if (existing) {
          throw new BadRequestException(
            "Debit advice GL code already exists",
          );
        }
      }

      Object.assign(debitAdviceGlAccount, {
        gl_code:
          updateDebitAdviceGlAccountDto.gl_code ||
          debitAdviceGlAccount.gl_code,

        category_code:
          updateDebitAdviceGlAccountDto.category_code ||
          debitAdviceGlAccount.category_code,

        category_name:
          updateDebitAdviceGlAccountDto.category_name ||
          debitAdviceGlAccount.category_name,

        gl_name:
          updateDebitAdviceGlAccountDto.gl_name ||
          debitAdviceGlAccount.gl_name,

        old_code:
          updateDebitAdviceGlAccountDto.old_code ||
          debitAdviceGlAccount.old_code,
      });

      await this.debitAdviceGlAccountRepository.save(
        debitAdviceGlAccount,
      );

      const updatedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.findOne({
          where: { id },
          relations: ["status"],
        });

      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_GL_ACCOUNT",
          method: "EDIT",
          raw_data: JSON.stringify(
            updatedDebitAdviceGlAccount,
          ),
          description: `Updated debit advice GL account: ${updatedDebitAdviceGlAccount.gl_code}`,
          status_id:
            updatedDebitAdviceGlAccount.status_id || 1,
        },
        userId,
      );

      this.sseEventEmitter.emitUpdateSignal(
        "debit-advice-gl-account",
        updatedDebitAdviceGlAccount.id,
      );

      return {
        ...updatedDebitAdviceGlAccount,
        status_name:
          updatedDebitAdviceGlAccount.status
            ? updatedDebitAdviceGlAccount.status
                .status_name
            : null,
      };
    } catch (error) {
      logger.error(
        "Error updating debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Soft delete
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

      debitAdviceGlAccount.status_id = 14;

      await this.debitAdviceGlAccountRepository.save(
        debitAdviceGlAccount,
      );

      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICE_GL_ACCOUNT",
          method: "DELETE",
          raw_data: JSON.stringify(
            debitAdviceGlAccount,
          ),
          description: `Deleted debit advice GL account: ${debitAdviceGlAccount.gl_code}`,
          status_id: 14,
        },
        userId,
      );

      this.sseEventEmitter.emitDeleteSignal(
        "debit-advice-gl-account",
        id,
      );
    } catch (error) {
      logger.error(
        "Error deleting debit advice GL account:",
        error,
      );

      throw error;
    }
  }

  // Toggle status
  async toggleStatus(
    id: number,
    userId: number,
  ) {
    const debitAdviceGlAccount =
      await this.debitAdviceGlAccountRepository.findOne({
        where: { id },
      });

    if (!debitAdviceGlAccount) {
      throw new NotFoundException(
        "Debit advice GL account not found.",
      );
    }

    const newStatusId =
      debitAdviceGlAccount.status_id === 1
        ? 14
        : 1;

    const newStatusEntity =
      await this.statusRepository.findOneBy({
        id: newStatusId,
      });

    if (!newStatusEntity) {
      throw new Error(
        "Target status not found.",
      );
    }

    debitAdviceGlAccount.status =
      newStatusEntity;

    debitAdviceGlAccount.status_id =
      newStatusEntity.id;

    const updatedDebitAdviceGlAccount =
      await this.debitAdviceGlAccountRepository.save(
        debitAdviceGlAccount,
      );

    await this.userAuditTrailCreateService.create(
      {
        service: "DEBIT_ADVICE_GL_ACCOUNT",
        method: "TOGGLE_STATUS",
        raw_data: JSON.stringify(
          updatedDebitAdviceGlAccount,
        ),
        description: `Toggled debit advice GL account: ${updatedDebitAdviceGlAccount.gl_code}`,
        status_id:
          updatedDebitAdviceGlAccount.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdateSignal(
      "debit-advice-gl-account",
      updatedDebitAdviceGlAccount.id,
    );

    return {
      message: `Debit advice GL account ${updatedDebitAdviceGlAccount.gl_code} successfully toggled ${
        newStatusId === 1
          ? "to active"
          : "to deleted"
      }.`,
      debit_advice_gl_account: {
        ...updatedDebitAdviceGlAccount,
        status_name:
          updatedDebitAdviceGlAccount.status
            ? updatedDebitAdviceGlAccount.status
                .status_name
            : null,
      },
    };
  }
}