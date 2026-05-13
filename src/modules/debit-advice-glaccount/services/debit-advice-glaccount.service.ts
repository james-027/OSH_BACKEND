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

import logger from "../../../config/logger";

@Injectable()
export class DebitAdviceGlAccountService {
  constructor(
    @InjectRepository(DebitAdviceGlAccount)
    private debitAdviceGlAccountRepository: Repository<DebitAdviceGlAccount>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
  ) {}

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
              createDebitAdviceGlAccountDto.gl_code.toUpperCase(),
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
            createDebitAdviceGlAccountDto.gl_code.toUpperCase(),

          category_code:
            createDebitAdviceGlAccountDto.category_code?.toUpperCase() ||
            null,

          category_name:
            createDebitAdviceGlAccountDto.category_name?.toUpperCase() ||
            null,

          gl_name:
            createDebitAdviceGlAccountDto.gl_name?.toUpperCase() ||
            null,

          old_code:
            createDebitAdviceGlAccountDto.old_code?.toUpperCase() ||
            null,

          created_by_id: userId,
        });

      const savedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.save(
          newDebitAdviceGlAccount,
        );

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "DEBIT_ADVICE_GL_ACCOUNT",
      //   action_name: "ADD",
      //   description: `Created debit advice GL account: ${createDebitAdviceGlAccountDto.gl_name}`,
      //   method: "create",
      // });

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
        updateDebitAdviceGlAccountDto.gl_code.toUpperCase() !==
          debitAdviceGlAccount.gl_code
      ) {
        const existingDebitAdviceGlAccount =
          await this.debitAdviceGlAccountRepository.findOne({
            where: {
              gl_code:
                updateDebitAdviceGlAccountDto.gl_code.toUpperCase(),
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
        updateDebitAdviceGlAccountDto.gl_code?.toUpperCase() ||
        debitAdviceGlAccount.gl_code;

      debitAdviceGlAccount.category_code =
        updateDebitAdviceGlAccountDto.category_code?.toUpperCase() ||
        debitAdviceGlAccount.category_code;

      debitAdviceGlAccount.category_name =
        updateDebitAdviceGlAccountDto.category_name?.toUpperCase() ||
        debitAdviceGlAccount.category_name;

      debitAdviceGlAccount.gl_name =
        updateDebitAdviceGlAccountDto.gl_name?.toUpperCase() ||
        debitAdviceGlAccount.gl_name;

      debitAdviceGlAccount.old_code =
        updateDebitAdviceGlAccountDto.old_code?.toUpperCase() ||
        debitAdviceGlAccount.old_code;

      const updatedDebitAdviceGlAccount =
        await this.debitAdviceGlAccountRepository.save(
          debitAdviceGlAccount,
        );

      // Log audit trail
      // await this.userAuditTrailCreateService.createAuditTrail({
      //   user_id: userId,
      //   module_name: "DEBIT_ADVICE_GL_ACCOUNT",
      //   action_name: "EDIT",
      //   description: `Updated debit advice GL account: ${debitAdviceGlAccount.gl_name}`,
      //   method: "update",
      // });

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
    } catch (error) {
      logger.error(
        "Error deleting debit advice GL account:",
        error,
      );

      throw error;
    }
  }
}