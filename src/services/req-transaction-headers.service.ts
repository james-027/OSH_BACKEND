import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { promises as fs } from "fs";
import * as path from "path";

import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CacheInvalidationService } from "./cache-invalidation.service";

import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { Warehouse } from "src/entities/Warehouse";
import { Requirement } from "src/entities/Requirement";
import { CreateReqTransactionHeaderDto } from "src/dto/CreateReqTransactionHeaderDto";
import { UpdateReqTransactionHeaderDto } from "src/dto/UpdateReqTransactionHeaderDto";
import { ResponseMapperService } from "./response-mapper.service";
import { SyncLog } from "src/entities/syncLog";
import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "src/entities/WarehouseRequirementDue";
import { RequirementReminder } from "src/entities/RequirementReminder";
import { ReqTransactionDetailsService } from "./req-transaction-details.service";
import { ReqTransactionDuesService } from "./req-transaction-dues.service";
import { WarehouseRequirementDuesService } from "./warehouse-requirement-dues.service";
import { CreateReqTransactionWithDetailsDto } from "src/dto/CreateReqTransactionWithDetailsDto";
import { formatDateToString } from "src/utils/date.utils";
import { FileUploadHandler } from "src/utils/file-upload.utils";
import { RequirementRemindersService } from "./requirement-reminders.service";
import { ReqTransactionDue } from "src/entities/ReqTransactionDue";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";
import { CommonUtilitiesService } from "./common-utilities.service";

@Injectable()
export class ReqTransactionHeadersService {
  constructor(
    @InjectRepository(ReqTransactionHeader)
    private reqTransactionHeadersRepository: Repository<ReqTransactionHeader>,
    @InjectRepository(ReqTransactionDue)
    private reqTransactionDuesRepository: Repository<ReqTransactionDue>,
    @InjectRepository(ReqTransactionDetail)
    private reqTransactionDetailsRepository: Repository<ReqTransactionDetail>,
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    @InjectRepository(Requirement)
    private requirementsRepository: Repository<Requirement>,
    @InjectRepository(WarehouseRequirement)
    private warehouseRequirementsRepository: Repository<WarehouseRequirement>,
    @InjectRepository(WarehouseRequirementDue)
    private warehouseRequirementDuesRepository: Repository<WarehouseRequirementDue>,
    @InjectRepository(RequirementReminder)
    private requirementRemindersRepository: Repository<RequirementReminder>,
    @InjectRepository(SyncLog)
    private syncLogRepository: Repository<SyncLog>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private cacheInvalidationService: CacheInvalidationService,
    private responseMapperService: ResponseMapperService,
    private reqTransactionDetailsService: ReqTransactionDetailsService,
    private reqTransactionDuesService: ReqTransactionDuesService,
    private warehouseRequirementDuesService: WarehouseRequirementDuesService,
    private requirementRemindersService: RequirementRemindersService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private commonUtilitiesService: CommonUtilitiesService,
  ) {}

  private getDataRepoRelations(): string[] {
    return [
      "status",
      "createdBy",
      "updatedBy",
      "warehouse",
      "warehouse.location",
      "warehouse.segment",
      "warehouse.warehouseType",
      "requirement",
      "transDueStatus",
      "reqTransactionDetails",
      "reqTransactionDues",
      "location",
    ];
  }

  async findAll(): Promise<any[]> {
    try {
      const records = await this.reqTransactionHeadersRepository.find({
        relations: this.getDataRepoRelations(),
      });

      return this.responseMapperService.mapEntitiesToResponse(records);
    } catch (error) {
      throw new Error("Failed to fetch req transaction headers");
    }
  }

  private async getAllowedLocationIds(
    userId?: number,
    roleId?: number,
  ): Promise<number[]> {
    if (!userId || !roleId) {
      return [];
    }
    return await this.commonUtilitiesService.getUserAllowedLocationIds(
      userId,
      roleId,
    );
  }

  /**
   * Get all req transaction headers grouped by trans_number with minimal response
   * Optional filter by trans_number
   * @param transNumber - Optional filter by specific transaction number
   * @returns Minimal grouped response: trans_number, trans_date, trans_remarks, location_id, location_name, createdBy, created_date, header_count
   */
  async findAllByTransNumber(
    transNumber?: string,
    userId?: number,
    roleId?: number,
    accessKeyId?: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    try {
      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

      let query = this.reqTransactionHeadersRepository
        .createQueryBuilder("header")
        .leftJoinAndSelect("header.location", "location")
        .leftJoinAndSelect("header.createdBy", "createdBy")
        .leftJoinAndSelect("header.requirement", "requirement")
        .select("header.trans_number", "trans_number")
        .addSelect("DATE_FORMAT(header.trans_date, '%Y-%m-%d')", "trans_date")
        .addSelect("header.trans_remarks", "trans_remarks")
        .addSelect("header.location_id", "location_id")
        .addSelect("location.location_name", "location_name")
        .addSelect("header.created_by", "created_by")
        .addSelect(
          "CONCAT(createdBy.first_name, ' ', createdBy.last_name)",
          "created_by_name",
        )
        .addSelect("header.created_at", "created_at")
        .addSelect("COUNT(header.id)", "header_count")
        .addSelect("requirement.requirement_name", "requirement_name")
        .addSelect("header.status_id", "status_id")
        .where("header.status_id = 1");

      if (transNumber) {
        query = query.andWhere("header.trans_number = :transNumber", {
          transNumber,
        });
      }
      if (accessKeyId) {
        query = query.andWhere("header.access_key_id = :accessKeyId", {
          accessKeyId,
        });
      }
      if (dateFrom && dateTo) {
        query = query.andWhere(
          "header.trans_date BETWEEN :dateFrom AND :dateTo",
          { dateFrom, dateTo },
        );
      }

      if (allowedLocationIds.length > 0) {
        query = query.andWhere(
          "header.location_id IN (:...allowedLocationIds)",
          {
            allowedLocationIds,
          },
        );
      }

      query = query
        .groupBy("header.trans_number")
        .orderBy("header.trans_number", "DESC");

      const response = await query.getRawMany();
      return response;
      // return response.map((row) => ({
      //   trans_number: row.trans_number,
      //   trans_date: row.trans_date,
      //   trans_remarks: row.trans_remarks || null,
      //   location_id: row.location_id,
      //   location_name: row.location_name || null,
      //   createdBy: row.created_by_name || null,
      //   created_date: row.created_date,
      //   header_count: parseInt(row.header_count, 10),
      //   requirement_name: row.requirement_name || null,
      // }));
    } catch (error) {
      throw new Error(
        `Failed to fetch req transaction headers grouped by trans_number: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get full details for a specific trans_number (details page view)
   * Returns full transaction header details WITHOUT grouping
   * @param transNumber - Transaction number to retrieve
   * @returns Array of full header details for the given trans_number
   */
  async findOneByTransNumber(transNumber: string): Promise<any[]> {
    try {
      if (!transNumber) {
        throw new BadRequestException("transNumber is required");
      }

      const records = await this.reqTransactionHeadersRepository.find({
        where: { trans_number: transNumber, status_id: 1 },
        relations: this.getDataRepoRelations(),
      });

      if (!records.length) {
        throw new NotFoundException(
          `Req transaction header(s) with trans_number ${transNumber} not found`,
        );
      }

      return records.map((record) => ({
        id: record.id,
        warehouse_id: record.warehouse_id,
        warehouse_ifs: record.warehouse?.warehouse_ifs || null,
        warehouse_name: record.warehouse?.warehouse_name || null,
        requirement_id: record.requirement_id,
        requirement_name: record.requirement?.requirement_name || null,
        location_id: record.location_id,
        location_name: record.location?.location_name || null,
        trans_date: record.trans_date,
        trans_remarks: record.trans_remarks,
        trans_due_status_id: record.trans_due_status_id,
        status_name: record.status?.status_name,
        created_by: record.created_by,
        access_key_id: record.access_key_id,
        updated_by: record.updated_by,
        created_at: record.created_at,
        created_user: record.createdBy
          ? `${record.createdBy.first_name} ${record.createdBy.last_name}`
          : null,
        reqTransactionDetails: (record.reqTransactionDetails || []).map(
          (detail) => ({
            ...detail,
            requirement_file_name:
              this.commonUtilitiesService.formatTransFileName(
                detail.requirement_file_name,
              ) || null,
          }),
        ),
        reqTransactionDues: record.reqTransactionDues || [],
      }));
      // return this.responseMapperService.mapEntitiesToResponse(records);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to fetch req transaction header by trans_number");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const record = await this.reqTransactionHeadersRepository.findOne({
        where: { id },
        relations: this.getDataRepoRelations(),
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction header with ID ${id} not found`,
        );
      }

      return this.responseMapperService.mapEntityToResponse(record);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to fetch req transaction header");
    }
  }

  async create(
    createDto: CreateReqTransactionHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check unique constraint: (warehouse_id, requirement_id, trans_date, status_id)
      const existingRecord = await this.reqTransactionHeadersRepository.findOne(
        {
          where: {
            warehouse_id: createDto.warehouse_id,
            requirement_id: createDto.requirement_id,
            trans_date: createDto.trans_date,
            status_id: createDto.status_id || 1,
          },
        },
      );

      if (existingRecord) {
        throw new BadRequestException(
          "This req transaction header combination already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newRecord = this.reqTransactionHeadersRepository.create({
        warehouse_id: createDto.warehouse_id,
        requirement_id: createDto.requirement_id,
        trans_date: createDto.trans_date,
        trans_remarks: createDto.trans_remarks || null,
        trans_due_status_id: createDto.trans_due_status_id || 1,
        status_id: createDto.status_id || 1,
        created_by: userId,
      });

      const savedRecord =
        await this.reqTransactionHeadersRepository.save(newRecord);

      const response = await this.findOne(savedRecord.id);

      // Clear req transaction caches (DRY: SSE + cache invalidation)
      await this.cacheInvalidationService.invalidateReqTransactions();

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionHeadersService",
          method: "create",
          raw_data: JSON.stringify(createDto),
          description: `Created req transaction header ID: ${savedRecord.id}`,
          status_id: 1,
        },
        userId,
      );

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create req transaction header");
    }
  }

  async update(
    id: number,
    updateDto: UpdateReqTransactionHeaderDto,
    userId: number,
  ): Promise<any> {
    try {
      const record = await this.reqTransactionHeadersRepository.findOne({
        where: { id },
      });

      if (!record) {
        throw new NotFoundException(
          `Req transaction header with ID ${id} not found`,
        );
      }

      // Check unique constraint if updating these fields
      if (
        updateDto.warehouse_id ||
        updateDto.requirement_id ||
        updateDto.trans_date ||
        updateDto.status_id
      ) {
        const checkWarehouseId = updateDto.warehouse_id || record.warehouse_id;
        const checkRequirementId =
          updateDto.requirement_id || record.requirement_id;
        const checkTransDate = updateDto.trans_date || record.trans_date;
        const checkStatusId = updateDto.status_id || record.status_id;

        const duplicateCheck =
          await this.reqTransactionHeadersRepository.findOne({
            where: {
              warehouse_id: checkWarehouseId,
              requirement_id: checkRequirementId,
              trans_date: checkTransDate,
              status_id: checkStatusId,
            },
          });

        if (duplicateCheck && duplicateCheck.id !== id) {
          throw new BadRequestException(
            "This req transaction header combination already exists",
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
        await this.reqTransactionHeadersRepository.save(record);

      // Clear req transaction caches (DRY: SSE + cache invalidation)
      await this.cacheInvalidationService.invalidateReqTransactions();

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionHeadersService",
          method: "update",
          raw_data: JSON.stringify(updateDto),
          description: `Updated req transaction header ID: ${id}`,
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
      throw new Error("Failed to update req transaction header");
    }
  }

  async toggleStatus(
    transHdrId: number,
    userId: number,
    statusId?: number,
    cancellationReason?: string,
  ): Promise<any> {
    try {
      const recordHdr = await this.reqTransactionHeadersRepository.findOne({
        where: { id: transHdrId },
        relations: [
          "reqTransactionDetails",
          "reqTransactionDues",
          "reqTransactionDues.warehouseRequirementDue",
        ],
      });

      if (!recordHdr) {
        throw new NotFoundException(
          `Req transaction header ID ${transHdrId} not found`,
        );
      }

      const transStatusId = statusId;

      // Update header status and cancellation reason
      recordHdr.status_id = transStatusId;
      recordHdr.updated_by = userId;
      if (cancellationReason) {
        recordHdr.cancellation_reason = cancellationReason;
      }
      const savedHdr =
        await this.reqTransactionHeadersRepository.save(recordHdr);

      if (!savedHdr) {
        throw new Error("Failed to update header");
      }

      // Update all related transaction details
      if (
        recordHdr.reqTransactionDetails &&
        recordHdr.reqTransactionDetails.length > 0
      ) {
        for (const detail of recordHdr.reqTransactionDetails) {
          detail.status_id = transStatusId;
          detail.updated_by = userId;
          await this.reqTransactionDetailsRepository.save(detail);
        }
      }

      // Update all related transaction dues and warehouse requirement dues
      const warehouseRequirementDueIds: number[] = [];
      if (
        recordHdr.reqTransactionDues &&
        recordHdr.reqTransactionDues.length > 0
      ) {
        for (const due of recordHdr.reqTransactionDues) {
          due.status_id = transStatusId;
          due.updated_by = userId;
          await this.reqTransactionDuesRepository.save(due);

          // Collect warehouse requirement due IDs
          if (due.warehouse_requirement_due_id) {
            warehouseRequirementDueIds.push(due.warehouse_requirement_due_id);
          }

          // Reactivate warehouse requirement due (set to status 1)
          if (due.warehouseRequirementDue) {
            due.warehouseRequirementDue.status_id = 1;
            due.warehouseRequirementDue.updated_by = userId;
            await this.warehouseRequirementDuesRepository.save(
              due.warehouseRequirementDue,
            );
          }
        }
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionHeadersService",
          method: "toggleStatus",
          raw_data: JSON.stringify({
            transHdrId,
            transStatusId,
            cancellationReason: cancellationReason || null,
            warehouseRequirementDueIds,
          }),
          description: `Toggled status for req transaction header ID: ${transHdrId} to status: ${transStatusId}${cancellationReason ? ` with reason: ${cancellationReason}` : ""}${warehouseRequirementDueIds.length > 0 ? ` | Affected warehouse requirement dues: ${warehouseRequirementDueIds.join(", ")}` : ""}`,
          status_id: 1,
        },
        userId,
      );

      // Clear req transaction caches (DRY: SSE + cache invalidation)
      await this.cacheInvalidationService.invalidateReqTransactions();
      await this.cacheInvalidationService.invalidateWarehouseRequirements();
      await this.cacheInvalidationService.invalidateRequirements();
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("req_transactions", savedHdr.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return this.findOne(savedHdr.id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error("Failed to toggle req transaction header status");
    }
  }

  /**
   * Cancel all req transaction headers with a specific trans_number
   * @param transNumber - Transaction number to cancel all headers for
   * @param userId - User ID performing the cancellation
   * @param cancellationReason - Reason for cancellation
   * @returns Summary of cancelled headers and related dues/details
   */
  async toggleStatusCancelByTransNumber(
    transNumber: string,
    userId: number,
    cancellationReason: string,
  ): Promise<any> {
    try {
      if (!transNumber) {
        throw new BadRequestException("transNumber is required");
      }

      if (!cancellationReason) {
        throw new BadRequestException("cancellationReason is required");
      }

      // Find all headers with this trans_number
      const headers = await this.reqTransactionHeadersRepository.find({
        where: { trans_number: transNumber },
        relations: [
          "reqTransactionDetails",
          "reqTransactionDues",
          "reqTransactionDues.warehouseRequirementDue",
        ],
      });

      if (!headers.length) {
        throw new NotFoundException(
          `No req transaction headers found with trans_number ${transNumber}`,
        );
      }

      const results = {
        total_headers: headers.length,
        cancelled_headers: 0,
        cancelled_details: 0,
        cancelled_dues: 0,
        errors: [],
      };

      // Status ID 5 = Cancelled
      const cancelledStatusId = 5;

      // Process each header
      for (const header of headers) {
        try {
          // Update header status
          header.status_id = cancelledStatusId;
          header.updated_by = userId;
          header.cancellation_reason = cancellationReason;
          await this.reqTransactionHeadersRepository.save(header);
          results.cancelled_headers++;

          // Update all related transaction details
          if (
            header.reqTransactionDetails &&
            header.reqTransactionDetails.length > 0
          ) {
            for (const detail of header.reqTransactionDetails) {
              detail.status_id = cancelledStatusId;
              detail.updated_by = userId;
              await this.reqTransactionDetailsRepository.save(detail);
              results.cancelled_details++;
            }
          }

          // Update all related transaction dues and warehouse requirement dues
          if (
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0
          ) {
            for (const due of header.reqTransactionDues) {
              due.status_id = cancelledStatusId;
              due.updated_by = userId;
              await this.reqTransactionDuesRepository.save(due);
              results.cancelled_dues++;

              // Deactivate warehouse requirement due (set to status 1 = active again)
              if (due.warehouseRequirementDue) {
                due.warehouseRequirementDue.status_id = 1;
                due.warehouseRequirementDue.updated_by = userId;
                await this.warehouseRequirementDuesRepository.save(
                  due.warehouseRequirementDue,
                );
              }
            }
          }

          // Audit trail for each header
          await this.userAuditTrailCreateService.create(
            {
              service: "ReqTransactionHeadersService",
              method: "toggleStatusCancelByTransNumber",
              raw_data: JSON.stringify({ transNumber, cancellationReason }),
              description: `Cancelled req transaction header ID: ${header.id} (trans_number: ${transNumber}) with reason: ${cancellationReason}`,
              status_id: 1,
            },
            userId,
          );
        } catch (headerError) {
          const headerErr = headerError as Error;
          results.errors.push({
            header_id: header.id,
            reason: headerErr.message || "Error processing header",
          });
        }
      }

      // Step: Rename folder to mark as cancelled after successful database updates
      if (results.cancelled_headers > 0) {
        try {
          const folderPath = path.join(
            process.cwd(),
            "uploads/" + process.env.UPLOAD_REQ_DIR,
            transNumber,
          );
          const newFolderPath = path.join(
            process.cwd(),
            "uploads/" + process.env.UPLOAD_REQ_DIR,
            `xx-${transNumber}`,
          );

          // Check if folder exists before renaming
          try {
            await fs.access(folderPath);
            // Folder exists, rename it
            await fs.rename(folderPath, newFolderPath);
            results["folder_renamed"] = true;
            results["folder_old_name"] = transNumber;
            results["folder_new_name"] = `xx-${transNumber}`;

            // Log folder rename in audit trail
            await this.userAuditTrailCreateService.create(
              {
                service: "ReqTransactionHeadersService",
                method: "toggleStatusCancelByTransNumber",
                raw_data: JSON.stringify({
                  transNumber,
                  oldFolderName: transNumber,
                  newFolderName: `xx-${transNumber}`,
                }),
                description: `Marked batch folder as cancelled: renamed 'uploads/${process.env.UPLOAD_REQ_DIR}/${transNumber}' to 'uploads/${process.env.UPLOAD_REQ_DIR}/xx-${transNumber}' for trans_number: ${transNumber}`,
                status_id: 1,
              },
              userId,
            );
          } catch (accessError) {
            // Folder doesn't exist, skip rename gracefully
            results["folder_renamed"] = false;
            results["folder_not_found"] = true;
            logger.warn(
              `Folder for trans_number ${transNumber} not found at ${folderPath}, skipping rename`,
            );
          }
        } catch (folderError) {
          // Log any unexpected errors but don't fail the cancellation
          const folderErr = folderError as Error;
          logger.error(
            `Error renaming folder for trans_number ${transNumber}: ${folderErr.message}`,
          );
          results["folder_rename_error"] = folderErr.message;
        }
      }

      if (results.cancelled_headers > 0) {
        // Clear req transaction caches (DRY: SSE + cache invalidation)
        await this.cacheInvalidationService.invalidateReqTransactions();
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
        await this.cacheInvalidationService.invalidateRequirements();

        // SSE Events
        try {
          this.sseEventEmitter.emitUpdateSignal("req_transactions", 0);
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      return results;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to cancel req transaction headers by trans_number: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Rollback warehouse transaction: Delete header, dues, and revert warehouse_requirement_due status
   * Also mark file as deleted (prefix with "del-") if it exists
   * Granular control for partial rollback per warehouse
   */
  private async rollbackWarehouseTransaction(
    headerInfo: {
      warehouse_id: number;
      req_transaction_header_id: number;
      req_transaction_due_id: number;
    },
    filename: string,
    userId: number,
  ): Promise<void> {
    try {
      // Step 1: Delete transaction due if it exists
      if (headerInfo.req_transaction_due_id) {
        const due = await this.reqTransactionDuesRepository.findOne({
          where: { id: headerInfo.req_transaction_due_id },
          relations: ["warehouseRequirementDue"],
        });

        if (due && due.warehouseRequirementDue) {
          // Revert warehouse requirement due to active status
          due.warehouseRequirementDue.status_id = 1; // active
          due.warehouseRequirementDue.updated_by = userId;
          await this.warehouseRequirementDuesRepository.save(
            due.warehouseRequirementDue,
          );
        }

        // Delete the transaction due
        await this.reqTransactionDuesRepository.delete(
          headerInfo.req_transaction_due_id,
        );
      }

      // Step 2: Delete transaction header
      await this.reqTransactionHeadersRepository.delete(
        headerInfo.req_transaction_header_id,
      );

      // Step 3: Mark file as deleted by renaming (if physical file exists)
      const sanitizedFilename = `del-${filename}`;
      logger.info(
        `Rollback: Marked file as deleted - renamed to: ${sanitizedFilename}`,
      );

      // Audit trail for rollback
      await this.userAuditTrailCreateService.create(
        {
          service: "ReqTransactionHeadersService",
          method: "createWithDetails (rollback)",
          raw_data: JSON.stringify({
            warehouse_id: headerInfo.warehouse_id,
            req_transaction_header_id: headerInfo.req_transaction_header_id,
            req_transaction_due_id: headerInfo.req_transaction_due_id,
            filename: filename,
          }),
          description: `Rolled back warehouse transaction - deleted header ID: ${headerInfo.req_transaction_header_id}, due ID: ${headerInfo.req_transaction_due_id}, reverted warehouse_requirement_due to active, marked file as: ${sanitizedFilename}`,
          status_id: 1,
        },
        userId,
      );
    } catch (rollbackError) {
      const rollbackErr = rollbackError as Error;
      logger.error(
        `Critical error during rollback for warehouse ${headerInfo.warehouse_id}: ${rollbackErr.message}`,
      );
      throw new Error(
        `Failed to rollback transaction for warehouse ${headerInfo.warehouse_id}: ${rollbackErr.message}`,
      );
    }
  }

  /**
   * Complex transaction creation with cascade operations
   * Creates headers, details, dues, and warehouse_requirement_dues
   */
  async createWithDetails(
    createDto: CreateReqTransactionWithDetailsDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    let successResults: any[] = [];
    const errors: any[] = [];

    try {
      // SECURITY: Validate batch before processing
      const batchValidation = FileUploadHandler.validateBatch(createDto.files);
      if (!batchValidation.valid) {
        throw new BadRequestException(batchValidation.error);
      }

      //* Step 1: Validate requirement exists
      const requirement = await this.requirementsRepository.findOne({
        where: { id: createDto.requirement_id },
      });

      if (!requirement) {
        throw new BadRequestException(
          `Requirement with ID ${createDto.requirement_id} not found`,
        );
      }

      //* Step 2: Get all warehouses from warehouse_ids
      const warehouses = await this.warehousesRepository.find({
        where: { id: In(createDto.warehouse_ids) },
      });

      if (warehouses.length === 0) {
        throw new BadRequestException(
          `No warehouses found for provided warehouse_ids`,
        );
      }

      // Create a map of warehouse_ifs to warehouse for file mapping
      const warehouseByIfs = new Map(
        warehouses.map((w) => [w.warehouse_ifs, w]),
      );

      // Get location_id and location abbreviation from the first warehouse
      let location_id: number | null = null;
      let location_abbr: string | null = null;
      if (warehouses.length > 0) {
        const firstWarehouse = await this.warehousesRepository.findOne({
          where: { id: warehouses[0].id },
          relations: ["location"],
        });
        if (firstWarehouse) {
          location_id = firstWarehouse.location_id;
          location_abbr = firstWarehouse.location
            ? firstWarehouse.location.location_abbr || null
            : null;
        }
      }

      //* Step 3: Calculate trans_date based on renewal_type_id
      let calculatedTransDate = formatDateToString(new Date());

      if (createDto.renewal_type_id === 1) {
        // ONE TIME: use today
        calculatedTransDate = formatDateToString(new Date());
      } else if (createDto.renewal_type_id === 2) {
        // ANNUAL: year only from transaction_date, add to current year
        if (!createDto.transaction_date) {
          throw new BadRequestException(
            "transaction_date (year) is required for ANNUAL renewal type",
          );
        }
        const year = parseInt(createDto.transaction_date, 10);
        const transDate = new Date(
          year,
          requirement.requirement_start - 1,
          requirement.requirement_start_days,
        );
        calculatedTransDate = formatDateToString(transDate);
      } else if (createDto.renewal_type_id === 3) {
        // QUARTERLY: year + quarter
        if (!createDto.transaction_date || createDto.quarter === undefined) {
          throw new BadRequestException(
            "transaction_date (year) and quarter are required for QUARTERLY renewal type",
          );
        }
        const year = parseInt(createDto.transaction_date, 10);
        const quarterMonth =
          (createDto.quarter - 1) * 3 + requirement.requirement_start;
        const transDate = new Date(
          year,
          quarterMonth - 1,
          requirement.requirement_start_days,
        );
        calculatedTransDate = formatDateToString(transDate);
      } else if (createDto.renewal_type_id === 4) {
        // MONTHLY: year + month
        if (!createDto.transaction_date) {
          throw new BadRequestException(
            "transaction_date (YYYY-MM) is required for MONTHLY renewal type",
          );
        }
        const [year, month] = createDto.transaction_date.split("-").map(Number);
        const transDate = new Date(
          year,
          month - 1,
          requirement.requirement_start_days,
        );
        calculatedTransDate = formatDateToString(transDate);
      }

      // console.log("Calculated trans date:", {
      //   calculatedTransDate,
      // });

      //* Generate using bulletproof service with database-level locking
      const trans_number =
        await this.commonUtilitiesService.generateTransactionNumber({
          transaction_type: "REQUIREMENTS",
          location_id: location_id,
          access_key_id: accessKeyId,
          format: "R{abbr}{key}{year}-{seq:4}",
          reset_per_year: true,
          currentDate: new Date(calculatedTransDate),
          abbr: location_abbr,
        });

      //* Step 3.5: PRE-VALIDATE ALL FILES (fail fast before creating any transactions)
      const fileValidationErrors: any[] = [];
      for (const file of createDto.files) {
        // Validate filename format
        const parts = file.filename.split("-");
        if (parts.length < 2) {
          fileValidationErrors.push({
            file: file.filename,
            reason:
              "Invalid filename format. Expected format: 'store-ifs - requirement-abbr.ext'",
            field: "filename",
          });
          continue;
        }

        const warehouseIfs = parts[0].trim();
        if (!warehouseByIfs.has(warehouseIfs)) {
          fileValidationErrors.push({
            file: file.filename,
            reason: "Store IFS not found in provided warehouses",
            field: "warehouse_ifs",
            warehouse_ifs: warehouseIfs,
          });
          continue;
        }

        // Validate file integrity
        const validation = FileUploadHandler.validateFile(
          file.filename,
          file.buffer,
        );
        if (!validation.valid) {
          fileValidationErrors.push({
            file: file.filename,
            reason: validation.error || "File validation failed",
            field: "file_validation",
          });
          continue;
        }
      }

      //* If ANY file fails validation, reject entire batch and return errors
      if (fileValidationErrors.length > 0) {
        return {
          success: {
            warehouse_ids: [],
            warehouse_names: [],
            req_transaction_header_ids: [],
            req_transaction_header_count: 0,
            message: `Batch rejected - file validation errors found (${fileValidationErrors.length} file(s) failed)`,
          },
          errors: fileValidationErrors,
        };
      }

      //* Step 4: Validation and header creation per warehouse
      for (const warehouse of warehouses) {
        try {
          // Get warehouse requirement
          const warehouseRequirement =
            await this.warehouseRequirementsRepository.findOne({
              where: {
                warehouse_id: warehouse.id,
                requirement_id: createDto.requirement_id,
                status_id: 1,
              },
              relations: ["requirement"],
            });

          if (!warehouseRequirement) {
            errors.push({
              warehouse_id: warehouse.id,
              reason:
                "Store requirement not found for this store and requirement",
              field: "warehouse_id",
            });
            continue;
          }

          //? Get current warehouse requirement due (today's due period)
          const today = formatDateToString(new Date());
          let currentDue: WarehouseRequirementDue;

          if (createDto.renewal_type_id === 1) {
            //* ONE TIME: get ANY due for this warehouse_requirement and status (no date filter)
            currentDue = await this.warehouseRequirementDuesRepository.findOne({
              where: {
                warehouse_requirement_id: warehouseRequirement.id,
                status_id: 1,
              },
              order: { id: "DESC" },
            });
          } else {
            //* OTHER TYPES: get due record within today's date range
            currentDue = await this.warehouseRequirementDuesRepository
              .createQueryBuilder("due")
              .where(
                "due.warehouse_requirement_id = :wrId and due.status_id = 1",
                {
                  wrId: warehouseRequirement.id,
                },
              )
              .andWhere(
                "due.warehouse_requirement_due_start <= :calculatedTransDate",
                {
                  calculatedTransDate,
                },
              )
              .andWhere(
                "due.warehouse_requirement_due_end >= :calculatedTransDate",
                {
                  calculatedTransDate,
                },
              )
              .getOne();
          }

          if (!currentDue) {
            errors.push({
              warehouse_id: warehouse.id,
              reason: "Store requirement for this cycle not found",
              field: "warehouse_requirement_due",
            });
            continue;
          }

          //* Step 5: Validate advance trans (if renewal_type ≠ ONE_TIME)
          if (createDto.renewal_type_id !== 1) {
            if (calculatedTransDate > today) {
              errors.push({
                warehouse_id: warehouse.id,
                reason: "Advanced Date Transaction is not allowed.",
                field: "trans_date",
                trans_date: calculatedTransDate,
              });
              continue;
            }
          }

          //* Step 6: Calculate trans_due_status_id based on reminder type status via requirement reminder count day.
          const reqReminderStatusDetail =
            await this.requirementRemindersService.calculateDueRequirementReminderStatus(
              createDto.requirement_id,
              currentDue.warehouse_requirement_due_date,
            );

          // console.log("reqReminderStatusDetail", reqReminderStatusDetail);

          let transDueStatusId = 1; // default: active
          if (createDto.renewal_type_id !== 0) {
            if (
              reqReminderStatusDetail?.reminderTypeName.toLowerCase() ===
              "overdue"
            ) {
              transDueStatusId = 2; // overdue status
            }
          }

          //* Step 7: Create transaction header

          const headerDto = {
            warehouse_id: warehouse.id,
            requirement_id: createDto.requirement_id,
            trans_date: calculatedTransDate,
            trans_remarks: createDto.remarks || null,
            trans_due_status_id: transDueStatusId,
            created_by: userId,
            access_key_id: accessKeyId,
            status_id: 1,
            trans_number,
            location_id,
          };

          const headerRecord =
            this.reqTransactionHeadersRepository.create(headerDto);
          const savedHeader =
            await this.reqTransactionHeadersRepository.save(headerRecord);

          //* Audit trail for header
          await this.userAuditTrailCreateService.create(
            {
              service: "ReqTransactionHeadersService",
              method: "createWithDetails",
              raw_data: JSON.stringify(headerDto),
              description: `Created req transaction header ID: ${savedHeader.id} with cascade details`,
              status_id: 1,
            },
            userId,
          );

          let saveReqTransactionDue: any;

          //* Step 8: Create warehouse requirement due (new cycle) - ONLY for non-ONE_TIME types
          if (createDto.renewal_type_id !== 1) {
            try {
              const lastDue =
                await this.warehouseRequirementDuesRepository.findOne({
                  where: {
                    warehouse_requirement_id: warehouseRequirement.id,
                    status_id: 1,
                  },
                  order: { id: "DESC" },
                });

              const createCycle = lastDue.id === currentDue.id ? true : false;

              if (createCycle) {
                //* Create new warehouse requirement due cycle
                const newDueStart = lastDue
                  ? formatDateToString(
                      this.commonUtilitiesService.addDaysFromDate(
                        lastDue.warehouse_requirement_due_end,
                        1,
                      ),
                    )
                  : today;

                //* Calculate new due end date based on renewal_type
                let newDueEnd: string;
                const startDate = new Date(newDueStart);

                const preDueReminderDate = new Date(startDate);
                preDueReminderDate.setDate(
                  preDueReminderDate.getDate() -
                    requirement.requirement_reminder,
                );

                const DueReminderDueDate = new Date(startDate);
                DueReminderDueDate.setDate(
                  DueReminderDueDate.getDate() +
                    requirement.requirement_due_days,
                );

                const postDueReminderDate = new Date(startDate);
                postDueReminderDate.setDate(
                  postDueReminderDate.getDate() +
                    requirement.requirement_reminder,
                );

                if (createDto.renewal_type_id === 2) {
                  //* ANNUAL
                  startDate.setFullYear(startDate.getFullYear() + 1);
                  newDueEnd = formatDateToString(startDate);
                } else if (createDto.renewal_type_id === 3) {
                  //* QUARTERLY
                  startDate.setMonth(startDate.getMonth() + 3);
                  newDueEnd = formatDateToString(startDate);
                } else if (createDto.renewal_type_id === 4) {
                  //* MONTHLY
                  startDate.setMonth(startDate.getMonth() + 1);
                  newDueEnd = formatDateToString(startDate);
                } else {
                  newDueEnd = newDueStart;
                }

                //* Deduct one day to the end of cycle.
                newDueEnd = formatDateToString(
                  this.commonUtilitiesService.deductDaysFromDate(newDueEnd, 1),
                );

                // console.log("new cycle end date:", {
                //   newDueEnd,
                // });

                const preDueReminderString =
                  formatDateToString(preDueReminderDate);
                const postDueReminderString =
                  formatDateToString(postDueReminderDate);
                const dueReminderDueString =
                  formatDateToString(DueReminderDueDate);

                const newDueRecord =
                  this.warehouseRequirementDuesRepository.create({
                    warehouse_requirement_id: warehouseRequirement.id,
                    warehouse_requirement_due_start: newDueStart,
                    warehouse_requirement_due_end: newDueEnd,
                    warehouse_requirement_due_pre_reminder_date:
                      preDueReminderString,
                    warehouse_requirement_due_post_reminder_date:
                      postDueReminderString,
                    warehouse_requirement_due_date: dueReminderDueString,
                    status_id: 1,
                    created_by: userId,
                  });

                const savedNewDue =
                  await this.warehouseRequirementDuesRepository.save(
                    newDueRecord,
                  );
              }

              //* Step 9A: Create req_transaction_due linking to the new warehouse_requirement_due
              const transactionDueDto = {
                req_transaction_header_id: savedHeader.id,
                warehouse_requirement_due_id: currentDue.id,
                status_id: 1,
              };

              saveReqTransactionDue =
                await this.reqTransactionDuesService.create(
                  transactionDueDto,
                  userId,
                );

              //* Step 9B: Deactivate currentDue after successful transaction due creation
              currentDue.status_id = 2;
              currentDue.updated_by = userId;
              await this.warehouseRequirementDuesRepository.save(currentDue);
            } catch (dueError) {
              //* Log due creation error but continue with file processing
              const dueErr = dueError as Error;
              await this.syncLogRepository.save({
                module: "ReqTransactionHeadersService",
                type: "createWithDetails",
                action: "create_warehouse_requirement_due",
                message: `Error creating store requirement due: ${dueErr.message}`,
                row_data: JSON.stringify({
                  warehouse_requirement_id: warehouseRequirement.id,
                }),
              });
            }
          } else {
            //* ONE TIME: link to current due without creating new cycle
            try {
              const transactionDueDto = {
                req_transaction_header_id: savedHeader.id,
                warehouse_requirement_due_id: currentDue.id,
                status_id: 1,
              };

              saveReqTransactionDue =
                await this.reqTransactionDuesService.create(
                  transactionDueDto,
                  userId,
                );

              //* Step 9B: Deactivate currentDue after successful transaction due creation
              currentDue.status_id = 2;
              currentDue.updated_by = userId;
              await this.warehouseRequirementDuesRepository.save(currentDue);
            } catch (dueError) {
              //* Log due linking error but continue
              const dueErr = dueError as Error;
              await this.syncLogRepository.save({
                module: "ReqTransactionHeadersService",
                type: "createWithDetails",
                action: "create_transaction_due",
                message: `Error linking transaction due: ${dueErr.message}`,
                row_data: JSON.stringify({
                  req_transaction_header_id: savedHeader.id,
                  warehouse_requirement_due_id: currentDue.id,
                }),
              });
            }
          }

          successResults.push({
            warehouse_id: warehouse.id,
            warehouse_name: warehouse.warehouse_name || "N/A",
            req_transaction_header_id: savedHeader.id,
            trans_date: calculatedTransDate,
            req_transaction_due_id: saveReqTransactionDue.id,
          });
        } catch (warehouseError) {
          const warehouseErr = warehouseError as Error;
          errors.push({
            warehouse_id: warehouse.id,
            reason: warehouseErr.message || "Error processing warehouse",
            field: "warehouse_processing",
          });
        }
      }

      //* Step 10: Process files and create transaction details (all files pre-validated)
      for (const file of createDto.files) {
        try {
          //* Parse warehouse_ifs from filename (already validated in pre-validation step)
          const parts = file.filename.split("-");
          const warehouseIfs = parts[0].trim();
          const warehouseFromFile = warehouseByIfs.get(warehouseIfs);

          //* Find the corresponding header created for this warehouse
          const correspondingHeader = successResults.find(
            (s) => s.warehouse_id === warehouseFromFile.id,
          );

          if (!correspondingHeader) {
            errors.push({
              file: file.filename,
              reason: `No transaction created for store ${warehouseFromFile.warehouse_name}`,
              field: "req_transaction_header_id",
            });
            continue;
          }

          //* Compress file to reduce size (~60% of original for images, PDFs unchanged)
          const compressedBuffer = await FileUploadHandler.compressFile(
            file.buffer,
            file.filename,
          );

          //* Save file to disk
          const savedFileInfo = await FileUploadHandler.saveFile(
            compressedBuffer,
            file.filename,
            correspondingHeader.req_transaction_header_id,
            "uploads/" + process.env.UPLOAD_REQ_DIR + "/" + trans_number,
          );

          //* Create transaction detail with saved file path
          const detailDto = {
            req_transaction_header_id:
              correspondingHeader.req_transaction_header_id,
            requirement_file_path: savedFileInfo.relativePath,
            requirement_file_name: savedFileInfo.filename,
            status_id: 1,
          };

          await this.reqTransactionDetailsService.create(detailDto, userId);
        } catch (fileError) {
          //* Try to extract warehouse_id from file for rollback
          try {
            const parts = file.filename.split("-");
            if (parts.length >= 2) {
              const warehouseIfs = parts[0].trim();
              const warehouse = warehouseByIfs.get(warehouseIfs);
              if (warehouse) {
                const correspondingHeader = successResults.find(
                  (s) => s.warehouse_id === warehouse.id,
                );
                if (correspondingHeader) {
                  //* ROLLBACK on file processing error
                  await this.rollbackWarehouseTransaction(
                    correspondingHeader,
                    file.filename,
                    userId,
                  );
                  successResults = successResults.filter(
                    (s) =>
                      s.req_transaction_header_id !==
                      correspondingHeader.req_transaction_header_id,
                  );
                }
              }
            }
          } catch (rollbackError) {
            const rollbackErr = rollbackError as Error;
            logger.error(
              `Failed to rollback transaction for file ${file.filename}: ${rollbackErr.message}`,
            );
          }

          errors.push({
            file: file.filename,
            reason: (fileError as Error).message || "Error processing file",
            field: "file_processing",
            rollback_status: "attempted",
          });
        }
      }

      //* Step 11: Build consolidated response
      const response = {
        success: {
          warehouse_ids: successResults.map((s) => s.warehouse_id),
          warehouse_names: successResults.map((s) => s.warehouse_name),
          req_transaction_header_ids: successResults.map(
            (s) => s.req_transaction_header_id,
          ),
          req_transaction_header_count: successResults.length,
          message: `Successfully created ${successResults.length} transaction(s)`,
        },
        errors: errors,
      };

      if (successResults.length > 0) {
        // Clear req transaction caches (DRY: SSE + cache invalidation)
        await this.cacheInvalidationService.invalidateReqTransactions();
        await this.cacheInvalidationService.invalidateWarehouseRequirements();
        await this.cacheInvalidationService.invalidateRequirements();
        // SSE Events
        try {
          this.sseEventEmitter.emitCreateSignal("req_transactions", 0);
        } catch (err) {
          logger.error("SSE event failed:", err);
        }
      }

      return response;
    } catch (error) {
      // Log fatal error
      const err = error as Error;
      await this.syncLogRepository.save({
        module: "ReqTransactionHeadersService",
        type: "createWithDetails",
        action: "error",
        message: err.message || "Unknown error in createWithDetails",
        row_data: JSON.stringify({
          warehouse_ids: createDto.warehouse_ids,
          requirement_id: createDto.requirement_id,
        }),
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        `Transaction creation failed: ${(error as Error).message}`,
      );
    }
  }
}
