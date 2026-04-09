import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { ReqTransactionDue } from "src/entities/ReqTransactionDue";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { WarehouseRequirementDue } from "src/entities/WarehouseRequirementDue";
import { CreateReqTransactionDueDto } from "src/dto/CreateReqTransactionDueDto";
import { UpdateReqTransactionDueDto } from "src/dto/UpdateReqTransactionDueDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SyncLog } from "src/entities/syncLog";

@Injectable()
export class ReqTransactionDuesService {
  constructor(
    @InjectRepository(ReqTransactionDue)
    private reqTransactionDuesRepository: Repository<ReqTransactionDue>,
    @InjectRepository(ReqTransactionHeader)
    private reqTransactionHeadersRepository: Repository<ReqTransactionHeader>,
    @InjectRepository(WarehouseRequirementDue)
    private warehouseRequirementDuesRepository: Repository<WarehouseRequirementDue>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
  ) {}

  private getDataRepoRelations(): string[] {
    return [
      "status",
      "createdBy",
      "updatedBy",
      "reqTransactionHeader",
      "warehouseRequirementDue",
    ];
  }

  async findAll(): Promise<any[]> {
    try {
      const records = await this.reqTransactionDuesRepository.find({
        relations: this.getDataRepoRelations(),
      });

      return this.responseMapperService.mapEntitiesToResponse(records);
    } catch (error) {
      throw new Error("Failed to fetch req transaction dues");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const record = await this.reqTransactionDuesRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction due with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(record);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to fetch req transaction due");
    }
  }

  async create(
    createDto: CreateReqTransactionDueDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check unique constraint: (req_transaction_header_id, warehouse_requirement_due_id, status_id)
      const existingRecord = await this.reqTransactionDuesRepository.findOne({
        where: {
          req_transaction_header_id: createDto.req_transaction_header_id,
          warehouse_requirement_due_id: createDto.warehouse_requirement_due_id,
          status_id: createDto.status_id || 1,
        },
      });

      if (existingRecord) {
        throw new BadRequestException(
          "This req transaction due combination already exists",
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

      // Verify warehouse requirement due exists
      const due = await this.warehouseRequirementDuesRepository.findOne({
        where: { id: createDto.warehouse_requirement_due_id },
      });

      if (!due) {
        throw new BadRequestException(
          `Warehouse requirement due with ID ${createDto.warehouse_requirement_due_id} not found`,
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRecord = this.reqTransactionDuesRepository.create({
        req_transaction_header_id: createDto.req_transaction_header_id,
        warehouse_requirement_due_id: createDto.warehouse_requirement_due_id,
        status_id: createDto.status_id || 1,
        created_by: userId,
      });

      const savedRecord =
        await this.reqTransactionDuesRepository.save(newRecord);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDuesService",
          method: "create",
          raw_data: JSON.stringify(createDto),
          description: `Created req transaction due ID: ${savedRecord.id}`,
          status_id: 1,
        },
        userId,
      );

      return this.findOne(savedRecord.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create req transaction due");
    }
  }

  async update(
    id: number,
    updateDto: UpdateReqTransactionDueDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.reqTransactionDuesRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction due with ID ${id} not found`,
        );
      }

      // Check unique constraint if updating these fields
      if (updateDto.warehouse_requirement_due_id || updateDto.status_id) {
        const checkHeaderId =
          updateDto.req_transaction_header_id ||
          record.req_transaction_header_id;
        const checkDueId =
          updateDto.warehouse_requirement_due_id ||
          record.warehouse_requirement_due_id;
        const checkStatusId = updateDto.status_id || record.status_id;

        const duplicateCheck = await this.reqTransactionDuesRepository.findOne({
          where: {
            req_transaction_header_id: checkHeaderId,
            warehouse_requirement_due_id: checkDueId,
            status_id: checkStatusId,
          },
        });

        if (duplicateCheck && duplicateCheck.id !== id) {
          throw new BadRequestException(
            "This req transaction due combination already exists",
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

      const savedRecord = await this.reqTransactionDuesRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDuesService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated req transaction due ID: ${id}`,
          status_id: 1,
        },
        userId,
      );

      return this.findOne(savedRecord.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to update req transaction due");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const record = await this.reqTransactionDuesRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction due with ID ${id} not found`,
        );
      }

      const newStatusId = record.status_id === 1 ? 2 : 1;

      record.status_id = newStatusId;
      record.updated_by = userId;

      const saved = await this.reqTransactionDuesRepository.save(record);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDuesService",
          method: "toggleStatus",
          raw_data: JSON.stringify({ id, newStatusId }),
          description: `Toggled status for req transaction due ID: ${id} to status: ${newStatusId}`,
          status_id: 1,
        },
        userId,
      );

      return this.findOne(saved.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to toggle req transaction due status");
    }
  }

  /**
   * Bulk create transaction dues with consolidated audit trail
   * Used during batch operations to insert multiple dues with single audit entry
   * @param createDtos Array of transaction due creation DTOs
   * @param userId User performing the operation
   * @returns Saved transaction due records
   */
  async bulkCreate(
    createDtos: CreateReqTransactionDueDto[],
    userId: number,
  ): Promise<any[]> {
    if (!createDtos || createDtos.length === 0) {
      throw new BadRequestException(
        "No transaction dues provided for bulk creation",
      );
    }

    try {
      // Verify user exists
      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Validate all DTOs before bulk insert
      for (const createDto of createDtos) {
        // Check unique constraint for each
        const existingRecord = await this.reqTransactionDuesRepository.findOne({
          where: {
            req_transaction_header_id: createDto.req_transaction_header_id,
            warehouse_requirement_due_id:
              createDto.warehouse_requirement_due_id,
            status_id: createDto.status_id || 1,
          },
        });

        if (existingRecord) {
          throw new BadRequestException(
            `Transaction due combination already exists for header ID: ${createDto.req_transaction_header_id}`,
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

        // Verify warehouse requirement due exists
        const due = await this.warehouseRequirementDuesRepository.findOne({
          where: { id: createDto.warehouse_requirement_due_id },
        });

        if (!due) {
          throw new BadRequestException(
            `Warehouse requirement due with ID ${createDto.warehouse_requirement_due_id} not found`,
          );
        }
      }

      // Bulk create records
      const newRecords = createDtos.map((dto) =>
        this.reqTransactionDuesRepository.create({
          req_transaction_header_id: dto.req_transaction_header_id,
          warehouse_requirement_due_id: dto.warehouse_requirement_due_id,
          status_id: dto.status_id || 1,
          created_by: userId,
        }),
      );

      // Bulk insert all at once
      const savedRecords =
        await this.reqTransactionDuesRepository.save(newRecords);

      // Single consolidated audit trail for entire batch
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionDuesService",
          method: "bulkCreate",
          raw_data: JSON.stringify(createDtos),
          description: `Bulk created ${savedRecords.length} req transaction dues`,
          status_id: 1,
        },
        userId,
      );

      // Return saved records with ID and header ID for mapping
      // No need to load full relations since we only need IDs
      return savedRecords.map((record) => ({
        id: record.id,
        req_transaction_header_id: record.req_transaction_header_id,
      }));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Failed to bulk create req transaction dues: ${error}`);
    }
  }
}
