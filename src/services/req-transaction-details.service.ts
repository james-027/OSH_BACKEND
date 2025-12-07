import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { CreateReqTransactionDetailDto } from "src/dto/CreateReqTransactionDetailDto";
import { UpdateReqTransactionDetailDto } from "src/dto/UpdateReqTransactionDetailDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SyncLog } from "src/entities/syncLog";

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
    private syncLogRepository: Repository<SyncLog>
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
          `Req transaction detail with ID ${id} not found`
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
    userId: number
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
        }
      );

      if (existingRecord) {
        throw new BadRequestException(
          "This req transaction detail combination already exists"
        );
      }

      // Verify header exists
      const header = await this.reqTransactionHeadersRepository.findOne({
        where: { id: createDto.req_transaction_header_id },
      });

      if (!header) {
        throw new BadRequestException(
          `Req transaction header with ID ${createDto.req_transaction_header_id} not found`
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
        userId
      );

      return this.findOne(savedRecord.id);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create req transaction detail");
    }
  }

  async update(
    id: number,
    updateDto: UpdateReqTransactionDetailDto,
    userId: number
  ): Promise<any> {
    try {
      const record = await this.reqTransactionDetailsRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction detail with ID ${id} not found`
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
            "This req transaction detail combination already exists"
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
        userId
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
          `Req transaction detail with ID ${id} not found`
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
        userId
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
