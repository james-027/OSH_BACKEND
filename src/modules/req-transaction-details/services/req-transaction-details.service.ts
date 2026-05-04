import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryRunner } from "typeorm";

import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { CreateReqTransactionDetailDto } from "src/modules/req-transaction-details/dto/CreateReqTransactionDetailDto";
import { UpdateReqTransactionDetailDto } from "src/modules/req-transaction-details/dto/UpdateReqTransactionDetailDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SyncLog } from "src/entities/syncLog";
import logger from "src/config/logger";

@Injectable()
export class ReqTransactionDetailsService {
  constructor(
    @InjectRepository(ReqTransactionDetail)
    private reqTransactionDetailsRepository: Repository<ReqTransactionDetail>,
    @InjectRepository(ReqTransactionHeader)
    private reqTransactionHeadersRepository: Repository<ReqTransactionHeader>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
  ) {}

  private getDataRepoRelations(): string[] {
    return ["status", "createdBy", "updatedBy", "reqTransactionHeader"];
  }

  async findAll(): Promise<any[]> {
    try {
      const records = await this.reqTransactionDetailsRepository.find({
        relations: this.getDataRepoRelations(),
      });

      return this.responseMapperService.mapEntitiesToResponse(records);
    } catch (error) {
      throw new Error("Failed to fetch req transaction details");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const record = await this.reqTransactionDetailsRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction detail with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(record);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to fetch req transaction detail");
    }
  }

  async create(
    createDto: CreateReqTransactionDetailDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check unique constraint: (req_transaction_header_id, requirement_file_path, requirement_file_name, status_id)
      const existingRecord = await this.reqTransactionDetailsRepository.findOne(
        {
          where: {
            req_transaction_header_id: createDto.req_transaction_header_id,
            requirement_file_path: createDto.requirement_file_path,
            requirement_file_name: createDto.requirement_file_name,
            status_id: createDto.status_id || 1,
          },
        },
      );

      if (existingRecord) {
        throw new BadRequestException(
          "This req transaction detail combination already exists",
        );
      }

      // Verify header exists
      const header = await this.reqTransactionHeadersRepository.findOne({
        where: { id: createDto.req_transaction_header_id },
      });

      if (!header) {
        throw new BadRequestException(
          `Req transaction header with ID ${createDto.req_transaction_header_id} not found`,
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRecord = this.reqTransactionDetailsRepository.create({
        req_transaction_header_id: createDto.req_transaction_header_id,
        requirement_file_path: createDto.requirement_file_path,
        requirement_file_name: createDto.requirement_file_name,
        status_id: createDto.status_id || 1,
        created_by: userId,
      });

      const savedRecord =
        await this.reqTransactionDetailsRepository.save(newRecord);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDetailsService",
          method: "create",
          raw_data: JSON.stringify(createDto),
          description: `Created req transaction detail ID: ${savedRecord.id}`,
          status_id: 1,
        },
        userId,
        false, // Suppress individual SSE events during batch file processing
      );

      return this.findOne(savedRecord.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create req transaction detail");
    }
  }

  /**
   * Bulk create transaction detail records during batch file processing
   * Consolidates all details into single database operation
   * @param createDtos Array of transaction detail DTOs
   * @param userId User performing the operation
   * @returns Saved transaction detail records (or empty array if none provided)
   */
  async bulkCreate(
    createDtos: CreateReqTransactionDetailDto[],
    userId: number,
    queryRunner?: QueryRunner,
  ): Promise<ReqTransactionDetail[]> {
    if (!createDtos || createDtos.length === 0) {
      logger.warn(
        "[DETAILS BULK CREATE] No transaction details provided for batch creation",
      );
      return [];
    }

    try {
      // Use queryRunner.manager if provided (for transaction context), otherwise use repositories
      const manager = queryRunner ? queryRunner.manager : this.reqTransactionDetailsRepository.manager;

      // Verify all headers exist (batch validation upfront)
      const headerIds = [
        ...new Set(createDtos.map((d) => d.req_transaction_header_id)),
      ];
      const existingHeaders = await manager.findByIds(
        ReqTransactionHeader,
        headerIds,
      );

      if (existingHeaders.length !== headerIds.length) {
        throw new BadRequestException(
          `${headerIds.length - existingHeaders.length} header IDs not found`,
        );
      }

      // Prepare batch records with userId
      const detailsToInsert = createDtos.map((dto) =>
        manager.create(ReqTransactionDetail, {
          req_transaction_header_id: dto.req_transaction_header_id,
          requirement_file_path: dto.requirement_file_path,
          requirement_file_name: dto.requirement_file_name,
          status_id: dto.status_id || 1,
          created_by: userId,
        }),
      );

      // Bulk insert all at once (single database operation)
      const savedDetails = await manager.save(
        ReqTransactionDetail,
        detailsToInsert,
      );

      // Create single consolidated audit trail entry for entire batch
      try {
        await this.userAuditTrailCreateService.create(
          {
            service: "ReqTransactionDetailsService",
            method: "bulkCreate",
            raw_data: JSON.stringify({
              count: savedDetails.length,
              header_ids: headerIds,
            }),
            description: `Batch created ${savedDetails.length} req transaction details`,
            status_id: 1,
          },
          userId,
          false, // Suppress SSE - will be emitted at end of batch in createWithDetails
        );
      } catch (auditErr) {
        logger.error(
          `[DETAILS BATCH] Audit trail creation failed: ${(auditErr as Error).message}`,
        );
        // Don't throw - audit failure shouldn't block transaction details
      }

      logger.info(
        `[DETAILS BATCH] Inserted ${savedDetails.length} transaction detail records`,
      );

      return savedDetails;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[DETAILS BATCH ERROR] Failed to bulk insert transaction details: ${errorMessage}`,
      );
      // Don't throw - details failure shouldn't block main batch
      return [];
    }
  }

  async update(
    id: number,
    updateDto: UpdateReqTransactionDetailDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.reqTransactionDetailsRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction detail with ID ${id} not found`,
        );
      }

      // Check unique constraint if updating these fields
      if (
        updateDto.requirement_file_path ||
        updateDto.requirement_file_name ||
        updateDto.status_id
      ) {
        const checkHeaderId =
          updateDto.req_transaction_header_id ||
          record.req_transaction_header_id;
        const checkFilePath =
          updateDto.requirement_file_path || record.requirement_file_path;
        const checkFileName =
          updateDto.requirement_file_name || record.requirement_file_name;
        const checkStatusId = updateDto.status_id || record.status_id;

        const duplicateCheck =
          await this.reqTransactionDetailsRepository.findOne({
            where: {
              req_transaction_header_id: checkHeaderId,
              requirement_file_path: checkFilePath,
              requirement_file_name: checkFileName,
              status_id: checkStatusId,
            },
          });

        if (duplicateCheck && duplicateCheck.id !== id) {
          throw new BadRequestException(
            "This req transaction detail combination already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      Object.assign(record, {
        ...updateDto,
        updated_by: userId,
      });

      const savedRecord =
        await this.reqTransactionDetailsRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDetailsService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated req transaction detail ID: ${id}`,
          status_id: 1,
        },
        userId,
        false, // Suppress individual SSE events during batch updates
      );

      return this.findOne(savedRecord.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to update req transaction detail");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const record = await this.reqTransactionDetailsRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction detail with ID ${id} not found`,
        );
      }

      const newStatusId = record.status_id === 1 ? 2 : 1;

      record.status_id = newStatusId;
      record.updated_by = userId;

      const saved = await this.reqTransactionDetailsRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDetailsService",
          method: "toggleStatus",
          raw_data: JSON.stringify({ id, newStatusId }),
          description: `Toggled status for req transaction detail ID: ${id} to status: ${newStatusId}`,
          status_id: 1,
        },
        userId,
        false, // Suppress individual SSE events during bulk toggle operations
      );

      return this.findOne(saved.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to toggle req transaction detail status");
    }
  }
}
