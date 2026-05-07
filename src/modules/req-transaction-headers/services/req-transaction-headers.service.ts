import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, QueryRunner } from "typeorm";
import { promises as fs } from "fs";
import * as path from "path";

import { UsersService } from "../../users/services/users.service";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

import { ReqTransactionHeader } from "src/entities/ReqTransactionHeader";
import { Warehouse } from "src/entities/Warehouse";
import { Requirement } from "src/entities/Requirement";
import { CreateReqTransactionHeaderDto } from "src/modules/req-transaction-headers/dto/CreateReqTransactionHeaderDto";
import { UpdateReqTransactionHeaderDto } from "src/modules/req-transaction-headers/dto/UpdateReqTransactionHeaderDto";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SyncLog } from "src/entities/syncLog";
import { WarehouseRequirement } from "src/entities/WarehouseRequirement";
import { WarehouseRequirementDue } from "src/entities/WarehouseRequirementDue";
import { WarehouseRequirementStart } from "src/entities/WarehouseRequirementStart";
import { RequirementReminder } from "src/entities/RequirementReminder";
import { ReqTransactionDetailsService } from "../../req-transaction-details/services/req-transaction-details.service";
import { ReqTransactionDuesService } from "../../req-transaction-dues/services/req-transaction-dues.service";
import { WarehouseRequirementDuesService } from "../../warehouse-requirements/services/warehouse-requirement-dues.service";
import { CreateReqTransactionWithDetailsDto } from "src/dto/CreateReqTransactionWithDetailsDto";
import { formatDateToString, isValidCalendarDate } from "src/utils/date.utils";
import { FileUploadHandler } from "src/utils/file-upload.utils";
import { RequirementRemindersService } from "../../requirements/services/requirement-reminders.service";
import { ReqTransactionDue } from "src/entities/ReqTransactionDue";
import { ReqTransactionDetail } from "src/entities/ReqTransactionDetail";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { GlobalFileProcessingQueueService } from "../../../services/global-file-processing-queue.service";
import { UploadProgressLoggerService } from "../../../services/upload-progress-logger.service";

@Injectable()
export class ReqTransactionHeadersService {
  // Track concurrent uploads for monitoring
  private static concurrentUploads = 0;

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
    @InjectRepository(WarehouseRequirementStart)
    private warehouseRequirementStartsRepository: Repository<WarehouseRequirementStart>,
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
    private uploadProgressLogger: UploadProgressLoggerService,
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
    requirementTypeId?: number,
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
      if (requirementTypeId) {
        query = query.andWhere(
          "requirement.requirement_type_id = :requirementTypeId",
          {
            requirementTypeId,
          },
        );
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
          "requirement",
          "reqTransactionDues.warehouseRequirementDue.warehouseRequirement",
        ],
      });

      if (!recordHdr) {
        throw new NotFoundException(
          `Req transaction header ID ${transHdrId} not found`,
        );
      }

      const transStatusId = statusId;

      //* 1. Update header status and cancellation reason
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

      //* 2. Update all related transaction details
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

      //* 3. Update all related transaction dues and warehouse requirement dues
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

          await this.cascadeWarehouseRequirementRelatedUpdates(
            recordHdr.requirement?.requirement_type_id,
            due,
            userId,
          );
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
          "requirement",
          "reqTransactionDues.warehouseRequirementDue.warehouseRequirement",
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
      const cancelledHeaderIds: number[] = [];

      // Process each header
      for (const header of headers) {
        try {
          //* 1. Update header status
          header.status_id = cancelledStatusId;
          header.updated_by = userId;
          header.cancellation_reason = cancellationReason;
          await this.reqTransactionHeadersRepository.save(header);
          results.cancelled_headers++;

          //* 2. Update all related transaction details
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

          //* 3. Update all related transaction dues and warehouse requirement dues
          if (
            header.reqTransactionDues &&
            header.reqTransactionDues.length > 0
          ) {
            for (const due of header.reqTransactionDues) {
              due.status_id = cancelledStatusId;
              due.updated_by = userId;
              await this.reqTransactionDuesRepository.save(due);
              results.cancelled_dues++;

              await this.cascadeWarehouseRequirementRelatedUpdates(
                header.requirement?.requirement_type_id,
                due,
                userId,
              );
            }
          }

          cancelledHeaderIds.push(header.id);
        } catch (headerError) {
          const headerErr = headerError as Error;
          results.errors.push({
            header_id: header.id,
            reason: headerErr.message || "Error processing header",
          });
        }
      }

          // Audit trail for each header
      if (cancelledHeaderIds.length > 0) {
          await this.userAuditTrailCreateService.create(
            {
              service: "ReqTransactionHeadersService",
              method: "toggleStatusCancelByTransNumber",
            raw_data: JSON.stringify({
              transNumber,
              cancellationReason,
              headerIds: cancelledHeaderIds,
            }),
            description: `Cancelled ${cancelledHeaderIds.length} req transaction header(s) for trans_number ${transNumber}: [${cancelledHeaderIds.join(", ")}] with reason: ${cancellationReason}`,
              status_id: 1,
            },
            userId,
          );
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

  private async cascadeWarehouseRequirementRelatedUpdates(
    requirement_type_id: number,
    due: ReqTransactionDue,
    userId: number,
  ): Promise<void> {
    switch (requirement_type_id) {
      case 1:
        // Reactivate warehouse requirement due (set to status 1)
        if (due.warehouseRequirementDue) {
          due.warehouseRequirementDue.status_id = 1;
          due.warehouseRequirementDue.updated_by = userId;
          await this.warehouseRequirementDuesRepository.save(
            due.warehouseRequirementDue,
          );
        }
        break;
      case 2:
        // Cancel warehouse requirement due, warehouse requirement start, warehouse requirement (set to status 5)
        if (due.warehouseRequirementDue) {
          // Set warehouse requirement due to cancelled status (5)
          due.warehouseRequirementDue.status_id = 5;
          due.warehouseRequirementDue.updated_by = userId;
          await this.warehouseRequirementDuesRepository.save(
            due.warehouseRequirementDue,
          );

          // Set warehouse requirement to cancelled status (5)
          if (due.warehouseRequirementDue.warehouseRequirement) {
            due.warehouseRequirementDue.warehouseRequirement.status_id = 5;
            due.warehouseRequirementDue.warehouseRequirement.updated_by =
              userId;
            await this.warehouseRequirementsRepository.save(
              due.warehouseRequirementDue.warehouseRequirement,
            );

            // Lazy load and cancel all warehouse requirement starts for this requirement
            const starts = await this.warehouseRequirementStartsRepository.find(
              {
                where: {
                  warehouse_requirement_id:
                    due.warehouseRequirementDue.warehouseRequirement.id,
                },
              },
            );

            if (starts && starts.length > 0) {
              for (const start of starts) {
                start.status_id = 5;
                start.updated_by = userId;
                await this.warehouseRequirementStartsRepository.save(start);
              }
            }
          }
        }
        break;
      default:
        break;
    }
  }

  /**
   * Rollback warehouse transaction: Set status=5 (Cancelled) for header and dues, revert warehouse_requirement_due status
   * Keep records for audit trail (don't delete)
   * Used when file processing fails for a warehouse
   */
  private async rollbackWarehouseTransaction(
    headerInfo: {
      warehouse_id: number;
      req_transaction_header_id: number;
      req_transaction_due_id: number;
      filename: string;
    },
    userId: number,
    queryRunner: QueryRunner, // Use separate transaction context
  ): Promise<void> {
    try {
      const manager = queryRunner.manager;

      // Step 1: Update transaction due status to 5 (Cancelled) if it exists
      if (headerInfo.req_transaction_due_id) {
        const due = await manager.findOne(ReqTransactionDue, {
          where: { id: headerInfo.req_transaction_due_id },
          relations: ["warehouseRequirementDue"],
        });

        if (due) {
          // Revert warehouse requirement due to active status (1 = active)
          if (due.warehouseRequirementDue) {
            due.warehouseRequirementDue.status_id = 1;
            due.warehouseRequirementDue.updated_by = userId;
            await manager.save(due.warehouseRequirementDue);
          }

          // Set transaction due to cancelled status (5 = cancelled)
          due.status_id = 5;
          due.updated_by = userId;
          await manager.save(due);
        }
      }

      // Step 2: Update transaction header status to 5 (Cancelled)
      const header = await manager.findOne(ReqTransactionHeader, {
        where: { id: headerInfo.req_transaction_header_id },
      });

      if (header) {
        header.status_id = 5; // Cancelled
        header.updated_by = userId;
        await manager.save(header);
      }

      logger.info(
        `Post-commit rollback: Cancelled transaction header ${headerInfo.req_transaction_header_id} for warehouse ${headerInfo.warehouse_id}`,
      );
    } catch (rollbackError) {
      const rollbackErr = rollbackError as Error;
      logger.error(
        `Critical error during post-commit rollback for warehouse ${headerInfo.warehouse_id}: ${rollbackErr.message}`,
      );
      throw new Error(
        `Failed to rollback transaction for warehouse ${headerInfo.warehouse_id}: ${rollbackErr.message}`,
      );
    }
  }

  /**
   * Helper: Parse Type 2 (Rental) filename format
   * Format: warehouse_ifs-requirement_abbr-YYYY-MM-DD_YYYY-MM-DD[optional (...)]
   * Examples:
   *   - 50000123-SRLC-2026-01-01_2026-12-31.pdf
   *   - 50000123-SRLC-2026-01-01_2026-12-31 (2).pdf
   *   - 50000123-SRLC-2026-01-01_2026-12-31 (copy).pdf
   *   - 50000123-SRLC-2026-01-01_2026-12-31 (anything_inside).pdf
   *
   * Optional duplicate counter can have any text inside parentheses: (2), (copy), (etc), (backup_v1), etc.
   * Text outside parentheses after date range will be rejected.
   *
   * Returns: { valid, warehouse_ifs, start_date, end_date, error }
   */
  private parseType2Filename(filename: string): {
    valid: boolean;
    warehouse_ifs?: string;
    start_date?: string;
    end_date?: string;
    error?: string;
  } {
    try {
      // Remove extension
      const withoutExt = filename.replace(/\.[^/.]+$/, "");

      // Format: warehouse_ifs-requirement_abbr-YYYY-MM-DD_YYYY-MM-DD[optional (any_text_here)]
      // Regex breakdown:
      // ^([^-]+)-([^-]+)-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})  <- base format (required)
      // (?:\s*\([^)]*\))?  <- optional: spaces + "(" + any chars except ")" + ")"
      // $  <- end of string (nothing else allowed)
      const regex =
        /^([^-]+)-([^-]+)-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:\s*\([^)]*\))?$/;
      const match = withoutExt.match(regex);

      if (!match) {
        return {
          valid: false,
          error:
            "Invalid format. Expected: store_ifs-requirement_abbr-YYYY-MM-DD_YYYY-MM-DD[optional (any_text)].ext | Examples: 50000123-SRLC-2026-01-01_2026-12-31.pdf OR 50000123-SRLC-2026-01-01_2026-12-31 (2).pdf",
        };
      }

      const warehouse_ifs = match[1];
      // const requirement_abbr = match[2]; // Captured but not used
      const start_date = match[3];
      const end_date = match[4];

      // Validate dates are actual valid calendar dates (e.g., reject 2026-11-31)
      if (!isValidCalendarDate(start_date)) {
        return {
          valid: false,
          error: `Invalid start date: '${start_date}' (not a valid calendar date, e.g., November only has 30 days)`,
        };
      }

      if (!isValidCalendarDate(end_date)) {
        return {
          valid: false,
          error: `Invalid end date: '${end_date}' (not a valid calendar date, e.g., November only has 30 days)`,
        };
      }

      // Validate start_date <= end_date (using string comparison works for YYYY-MM-DD format)
      if (start_date > end_date) {
        return {
          valid: false,
          error: "Start date must be before or equal to end date",
        };
      }

      return {
        valid: true,
        warehouse_ifs,
        start_date,
        end_date,
      };
    } catch (err) {
      return {
        valid: false,
        error: `Filename parsing error: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Process Requirements Dynamic Type
   * Finds existing warehouse_requirement (created by cron) and links transaction
   */
  private async processRequirement(
    warehouses: Warehouse[],
    requirement: Requirement,
    calculatedTransDate: string,
    userId: number,
    accessKeyId: number,
    trans_number: string,
    location_id: number,
    files: any[],
    queryRunner: QueryRunner, // Use outer transaction
  ): Promise<{
    successResults: any[];
    errors: any[];
    auditTrailsToCreate: any[];
  }> {
    const successResults: any[] = [];
    const errors: any[] = [];
    const auditTrailsToCreate: any[] = [];
    const transactionDuesToCreate: any[] = [];
    let rawData = "";
    let description = "";
    const today = formatDateToString(new Date());

    switch (requirement.requirement_type_id) {
      case 1:
        // Type 1 (Regulatory) processing - use outer transaction
        try {
          for (const warehouse of warehouses) {
            // Get existing warehouse requirement (from cron - must exist for Type 1)
            const warehouseRequirement = await queryRunner.manager.findOne(
              WarehouseRequirement,
              {
                where: {
                  warehouse_id: warehouse.id,
                  requirement_id: requirement.id,
                  status_id: 1,
                },
                relations: ["requirement"],
              },
            );

            if (!warehouseRequirement) {
              errors.push({
                warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                reason:
                  "Store requirement not found for this store and requirement",
                field: "warehouse_id",
              });
              continue;
            }

            // Get current warehouse requirement due
            let currentDue: WarehouseRequirementDue;

            if (requirement.renewal_type_id === 1) {
              // ONE TIME: get ANY due
              currentDue = await queryRunner.manager.findOne(
                WarehouseRequirementDue,
                {
                  where: {
                    warehouse_requirement_id: warehouseRequirement.id,
                    status_id: 1,
                  },
                  order: { id: "DESC" },
                },
              );
            } else {
              // OTHER TYPES: get due record within date range
              currentDue = await queryRunner.manager
                .createQueryBuilder(WarehouseRequirementDue, "due")
                .where(
                  "due.warehouse_requirement_id = :wrId and due.status_id <> 5",
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
                warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                reason: "Store requirement for this cycle not found",
                field: "warehouse_requirement_due",
              });
              continue;
            }

            if (currentDue.status_id === 2) {
              errors.push({
                warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                reason: "Store requirement for this cycle is already fulfilled",
                field: "warehouse_requirement_due",
              });
              continue;
            }

            // Validate advance trans (if renewal_type ≠ ONE_TIME)
            if (requirement.renewal_type_id !== 1) {
              if (calculatedTransDate > today) {
                errors.push({
                  warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                  reason: "Advanced Date Transaction is not allowed.",
                  field: "trans_date",
                  trans_date: calculatedTransDate,
                });
                continue;
              }
            }

            // Calculate trans_due_status_id
            const reqReminderStatusDetail =
              await this.requirementRemindersService.calculateDueRequirementReminderStatus(
                requirement.id,
                currentDue.warehouse_requirement_due_date,
              );

            let transDueStatusId = 1;
            if (requirement.renewal_type_id !== 0) {
              if (
                reqReminderStatusDetail?.reminderTypeName.toLowerCase() ===
                "overdue"
              ) {
                transDueStatusId = 2;
              }
            }

            // Create transaction header
            const headerDto = {
              warehouse_id: warehouse.id,
              requirement_id: requirement.id,
              trans_date: calculatedTransDate,
              trans_remarks: null,
              trans_due_status_id: transDueStatusId,
              created_by: userId,
              access_key_id: accessKeyId,
              status_id: 1,
              trans_number,
              location_id,
            };

            const headerRecord = queryRunner.manager.create(
              ReqTransactionHeader,
              headerDto,
            );
            const savedHeader = await queryRunner.manager.save(headerRecord);

            // Create warehouse requirement due (new cycle) - ONLY for non-ONE_TIME types
            if (requirement.renewal_type_id !== 1) {
              try {
                const lastDue = await queryRunner.manager.findOne(
                  WarehouseRequirementDue,
                  {
                    where: {
                      warehouse_requirement_id: warehouseRequirement.id,
                      status_id: 1,
                    },
                    order: { id: "DESC" },
                  },
                );

                const createCycle = lastDue.id === currentDue.id ? true : false;

                if (createCycle) {
                  // Create new warehouse requirement due cycle
                  const newDueStart = lastDue
                    ? formatDateToString(
                        this.commonUtilitiesService.addDaysFromDate(
                          lastDue.warehouse_requirement_due_end,
                          1,
                        ),
                      )
                    : today;

                  // Calculate new due end date based on renewal_type
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

                  if (requirement.renewal_type_id === 2) {
                    startDate.setFullYear(startDate.getFullYear() + 1);
                    newDueEnd = formatDateToString(startDate);
                  } else if (requirement.renewal_type_id === 3) {
                    startDate.setMonth(startDate.getMonth() + 3);
                    newDueEnd = formatDateToString(startDate);
                  } else if (requirement.renewal_type_id === 4) {
                    startDate.setMonth(startDate.getMonth() + 1);
                    newDueEnd = formatDateToString(startDate);
                  } else {
                    newDueEnd = newDueStart;
                  }

                  newDueEnd = formatDateToString(
                    this.commonUtilitiesService.deductDaysFromDate(
                      newDueEnd,
                      1,
                    ),
                  );

                  const preDueReminderString =
                    formatDateToString(preDueReminderDate);
                  const postDueReminderString =
                    formatDateToString(postDueReminderDate);
                  const dueReminderDueString =
                    formatDateToString(DueReminderDueDate);

                  const newDueRecord = queryRunner.manager.create(
                    WarehouseRequirementDue,
                    {
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
                    },
                  );

                  await queryRunner.manager.save(newDueRecord);
                }
              } catch (dueError) {
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
            }

            // Collect transaction due DTO
            const transactionDueDto = {
              req_transaction_header_id: savedHeader.id,
              warehouse_requirement_due_id: currentDue.id,
              status_id: 1,
            };

            transactionDuesToCreate.push(transactionDueDto);

            // Deactivate currentDue
            currentDue.status_id = 2;
            currentDue.updated_by = userId;
            await queryRunner.manager.save(currentDue);

            successResults.push({
              warehouse_id: warehouse.id,
              warehouse_name: warehouse.warehouse_name || "N/A",
              warehouse_ifs: warehouse.warehouse_ifs,
              req_transaction_header_id: savedHeader.id,
              trans_date: calculatedTransDate,
              req_transaction_due_id: null,
            });

            auditTrailsToCreate.push({
              service: "ReqTransactionHeadersService",
              method: `createWithDetails (Requirement Type ${requirement.requirement_type_id} - ${requirement.requirementType.requirement_type_name})`,
              raw_data: JSON.stringify({
                warehouse_id: warehouse.id,
                warehouse_name: warehouse.warehouse_name,
                req_transaction_header_id: savedHeader.id,
                requirement_id: requirement.id,
              }),
              description: `Created warehouse transaction (Requirement Type ${requirement.requirement_type_id} - ${requirement.requirementType.requirement_type_name}) - warehouse: ${warehouse.warehouse_name}, header ID: ${savedHeader.id}, trans_number: ${trans_number}`,
              status_id: 1,
            });
          }
        } catch (transactionError) {
          // Let outer transaction handle rollback
          const transErr = transactionError as Error;
          errors.push({
            reason: `Case ${requirement.requirement_type_id} processing failed: ${transErr.message}`,
            field: "warehouse_requirement_transaction",
          });
          logger.error(
            `Case ${requirement.requirement_type_id} processing error: ${transErr.message}`,
            transErr.stack,
          );
          throw transactionError; // Re-throw for outer transaction rollback
        }
        break;

      case 2:
        // Type 2 (Non Regulatory) processing - use outer transaction (queryRunner parameter)
        try {
          // Extract rental dates from files (should be same for all files in this batch)
          const rentalDates: Map<
            string,
            { start_date: string; end_date: string }
          > = new Map();

          for (const file of files) {
            const parseResult = this.parseType2Filename(file.filename);

            if (!parseResult.valid) {
              errors.push({
                file: file.filename,
                reason: parseResult.error,
                field: "filename_parsing",
              });
              continue;
            }

            rentalDates.set(file.filename, {
              start_date: parseResult.start_date,
              end_date: parseResult.end_date,
            });
          }

          // Process each warehouse
          for (const warehouse of warehouses) {
            // Find files for this warehouse
            const warehouseFiles = files.filter((f) => {
              const parts = f.filename.split("-");
              return parts[0].trim() === warehouse.warehouse_ifs;
            });

            if (warehouseFiles.length === 0) {
              continue; // No files for this warehouse
            }

            // Get rental dates from first file (all should have same dates for logical batch)
            const firstFile = warehouseFiles[0];
            const rentalInfo = rentalDates.get(firstFile.filename);

            if (!rentalInfo) {
              errors.push({
                warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                file: firstFile.filename,
                reason: "Could not parse rental dates from filename",
                field: "filename_parsing",
              });
              continue;
            }

            const { start_date, end_date } = rentalInfo;

            // Check if active rental already exists
            const existingReq = await queryRunner.manager.findOne(
              WarehouseRequirement,
              {
                where: {
                  warehouse_id: warehouse.id,
                  requirement_id: requirement.id,
                  status_id: In([1]), // Active, since one active at atime
                },
                relations: [
                  "warehouseRequirementStarts",
                  "warehouseRequirementDues",
                ],
                order: { id: "DESC" },
              },
            );

            // If exists, mark as replaced
            if (existingReq) {
              //check start and end date of existing rental and compare with new rental, if new rental is within the existing rental period, reject the transaction
              const existingReqStart =
                existingReq.warehouseRequirementStarts &&
                existingReq.warehouseRequirementStarts.length > 0
                  ? existingReq.warehouseRequirementStarts[0]
                      .warehouse_requirement_start
                  : null;
              const existingReqEnd =
                existingReq.warehouseRequirementDues &&
                existingReq.warehouseRequirementDues.length > 0
                  ? existingReq.warehouseRequirementDues[0]
                      .warehouse_requirement_due_end
                  : null;

              if (existingReqStart && existingReqEnd) {
                const newStart = new Date(start_date);
                const newEnd = new Date(end_date);
                const existingStartDate = new Date(existingReqStart);
                const existingEndDate = new Date(existingReqEnd);

                if (
                  newStart >= existingStartDate &&
                  newEnd <= existingEndDate
                ) {
                  errors.push({
                    warehouse_name: `${warehouse.warehouse_ifs} - ${warehouse.warehouse_name}`,
                    file: firstFile.filename,
                    reason:
                      "A record of requirement already exists within this period (" +
                      start_date +
                      " to " +
                      end_date +
                      ") and cannot be replaced.",
                    field: "requirement_period",
                  });
                  continue;
                }
              }

              existingReq.status_id = 2; // Mark old version as inactive
              await queryRunner.manager.save(existingReq);
            }

            // Create NEW warehouse_requirement (rental version)
            const newRental = queryRunner.manager.create(WarehouseRequirement, {
              warehouse_id: warehouse.id,
              requirement_id: requirement.id,
              status_id: 1,
              access_key_id: accessKeyId,
              created_by: userId,
            });

            const savedRental = await queryRunner.manager.save(newRental);

            // Create warehouse_requirement_starts
            const startRecord = queryRunner.manager.create(
              WarehouseRequirementStart,
              {
                warehouse_requirement_id: savedRental.id,
                warehouse_requirement_start: start_date,
                status_id: 2,
                created_by: userId,
              },
            );

            await queryRunner.manager.save(startRecord);

            // Create warehouse_requirement_dues (one due = expiration date)
            const preDueReminderDate = new Date(start_date);
            preDueReminderDate.setDate(
              preDueReminderDate.getDate() - requirement.requirement_reminder,
            );
            const preDueReminderDateString =
              formatDateToString(preDueReminderDate);
            const postDueReminderDate = new Date(start_date);
            postDueReminderDate.setDate(
              postDueReminderDate.getDate() + requirement.requirement_reminder,
            );
            const postDueReminderDateString =
              formatDateToString(postDueReminderDate);
            const dueRecord = queryRunner.manager.create(
              WarehouseRequirementDue,
              {
                warehouse_requirement_id: savedRental.id,
                warehouse_requirement_due_start: start_date,
                warehouse_requirement_due_end: end_date,
                warehouse_requirement_due_pre_reminder_date:
                  preDueReminderDateString,
                warehouse_requirement_due_post_reminder_date:
                  postDueReminderDateString,
                warehouse_requirement_due_date: end_date, // Expiration date
                status_id: 2,
                created_by: userId,
              },
            );

            const savedDue = await queryRunner.manager.save(dueRecord);

            // Create transaction header
            const today = formatDateToString(new Date());
            const headerDto = {
              warehouse_id: warehouse.id,
              requirement_id: requirement.id,
              trans_date: today,
              trans_remarks: null,
              trans_due_status_id: 1, // Active
              created_by: userId,
              access_key_id: accessKeyId,
              status_id: 1,
              trans_number,
              location_id,
            };

            const headerRecord = queryRunner.manager.create(
              ReqTransactionHeader,
              headerDto,
            );
            const savedHeader = await queryRunner.manager.save(headerRecord);

            // Collect transaction due DTO
            const transactionDueDto = {
              req_transaction_header_id: savedHeader.id,
              warehouse_requirement_due_id: savedDue.id,
              status_id: 1,
            };

            transactionDuesToCreate.push(transactionDueDto);

            successResults.push({
              warehouse_id: warehouse.id,
              warehouse_name: warehouse.warehouse_name || "N/A",
              warehouse_ifs: warehouse.warehouse_ifs,
              req_transaction_header_id: savedHeader.id,
              trans_date: today,
              req_transaction_due_id: null,
              rental_valid_from: start_date,
              rental_valid_until: end_date,
            });

            auditTrailsToCreate.push({
              service: "ReqTransactionHeadersService",
              method: `createWithDetails (Requirement Type ${requirement.requirement_type_id} - ${requirement.requirementType.requirement_type_name})`,
              raw_data: JSON.stringify({
                warehouse_id: warehouse.id,
                warehouse_name: warehouse.warehouse_name,
                req_transaction_header_id: savedHeader.id,
                warehouse_requirement_id: savedRental.id,
                requirement_id: requirement.id,
                rental_start: start_date,
                rental_end: end_date,
              }),
              description: `Created warehouse transaction (Requirement Type ${requirement.requirement_type_id} - ${requirement.requirementType.requirement_type_name}) - warehouse: ${warehouse.warehouse_name}, header ID: ${savedHeader.id}, trans_number: ${trans_number}`,
              status_id: 1,
            });
          }
        } catch (transactionError) {
          // Let outer transaction handle rollback
          const transErr = transactionError as Error;
          errors.push({
            reason: `Case ${requirement.requirement_type_id} processing failed: ${transErr.message}`,
            field: "warehouse_requirement_transaction",
          });
          logger.error(
            `Case ${requirement.requirement_type_id} processing error: ${transErr.message}`,
            transErr.stack,
          );
          throw transactionError; // Re-throw for outer transaction rollback
        }
        break;

      default:
        errors.push({
          reason: `Unsupported requirement type ID: ${requirement.requirement_type_id}`,
          field: "requirement_type_id",
        });
    }

    // Bulk create transaction dues
    if (transactionDuesToCreate.length > 0) {
      try {
        const createdDues = await this.reqTransactionDuesService.bulkCreate(
          transactionDuesToCreate,
          userId,
          queryRunner, // ✅ Pass queryRunner to use same transaction context
        );

        createdDues.forEach((due) => {
          const result = successResults.find(
            (r) =>
              r.req_transaction_header_id === due.req_transaction_header_id,
          );
          if (result) {
            result.req_transaction_due_id = due.id;
          }
        });
      } catch (bulkDueError) {
        const bulkErr = bulkDueError as Error;
        errors.push({
          transaction_due: "batch_creation",
          reason: `Failed to bulk create transaction dues: ${bulkErr.message}`,
          field: "req_transaction_dues",
        });
      }
    }

    return { successResults, errors, auditTrailsToCreate };
  }

  private async calculateTransDate(
    createDto: CreateReqTransactionWithDetailsDto,
    requirement: Requirement,
  ): Promise<string> {
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

    return calculatedTransDate;
  }

  /**
   * Complex transaction creation with cascade operations
   * Creates headers, details, dues, and warehouse_requirement_dues
   *
   * OPTIMIZATION: Hybrid Batching + Streaming Compression
   * 1. LOGICAL BATCHING: Frontend sends 50 files per payload (trans_number grouping)
   *    - All 50 files share ONE trans_number (business logic preserved)
   * 2. SUB-BATCH PROCESSING: Files processed in 5-file chunks (memory efficiency)
   *    - Peak memory with sub-batching: ~25-50MB (5 file buffers × 5-10MB each)
   *    - For 10 concurrent users: 250-500MB total (not 1-2.5GB)
   * 3. STREAMING COMPRESSION: Compress directly to disk (NO intermediate buffer)
   *    - Old: buffer (5MB) + compressedBuffer (3MB) = 8MB per file
   *    - New: buffer (5MB) only = 37.5% additional memory savings
   *    - Process: buffer → sharp.toFile() → disk → freed memory
   * 4. FILE CLEANUP: Explicit buffer nullification + optional GC after each sub-batch
   *
   * RESULT: Combined approach reduces memory usage by 90%+ vs. sequential processing
   */
  async createWithDetails(
    createDto: CreateReqTransactionWithDetailsDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    // Track concurrent uploads
    ReqTransactionHeadersService.concurrentUploads++;
    const uploadId = Math.random().toString(36).substr(2, 9);
    const uploadStartTime = Date.now();

    const getMemoryStats = () => {
      const memUsage = process.memoryUsage();
      return {
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
        rss: (memUsage.rss / 1024 / 1024).toFixed(2),
        external: (memUsage.external / 1024 / 1024).toFixed(2),
      };
    };

    const initialMemStats = getMemoryStats();

    logger.info(
      `[UPLOAD STARTED] ID: ${uploadId} | Concurrent uploads: ${ReqTransactionHeadersService.concurrentUploads} | Memory: Heap=${initialMemStats.heapUsed}MB, RSS=${initialMemStats.rss}MB`,
    );

    // Enhanced logging: Track upload progress with new structured logger
    this.uploadProgressLogger.logUploadStarted(
      uploadId,
      createDto.files.length,
      userId,
      {
        heap: `${initialMemStats.heapUsed}MB`,
        rss: `${initialMemStats.rss}MB`,
      },
    );

    let successResults: any[] = [];
    const errors: any[] = [];
    const auditTrailsToCreate: any[] = []; // Batch audit trails to create once at the end
    const transactionDuesToCreate: any[] = []; // Batch transaction dues for bulk creation
    const transactionDueMapping: Map<string, any> = new Map(); // Map to track header => due ID
    const detailsToCreate: any[] = []; // Batch transaction details for bulk creation

    // Variables for tracking in finally block
    let trans_number = "";
    let filesProcessed = 0;
    let filesFailedCount = 0;
    const failedWarehouseFilePaths: string[] = []; // Track files to delete after commit (orphaned files)
    const failedHeadersToRollback: any[] = []; // Track headers to cancel after commit (status = 5)

    try {
      // SECURITY: Validate batch before processing
      const batchValidation = FileUploadHandler.validateBatch(createDto.files);
      if (!batchValidation.valid) {
        throw new BadRequestException(batchValidation.error);
      }

      //* Step 1: Validate requirement exists
      const requirement = await this.requirementsRepository.findOne({
        where: { id: createDto.requirement_id },
        relations: ["requirementType"],
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
      const calculatedTransDate = await this.calculateTransDate(
        createDto,
        requirement,
      );

      //* Step 3.5: PRE-VALIDATE ALL FILES (fail fast before creating any transactions)
      //* NOTE: trans_number generation MOVED to just before commit to avoid sequence waste on failed transactions
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

      //* Step 4: START ATOMIC TRANSACTION for all database operations
      //* This ensures: (1) all database changes are committed together
      //*             (2) trans_number is generated JUST BEFORE commit to avoid waste on failure
      //*             (3) headers are updated with trans_number BEFORE final commit
      const queryRunner =
        this.reqTransactionHeadersRepository.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        //* Step 4.5: Type-specific requirement processing (Type 1 or Type 2)
        //* Route to appropriate handler based on requirement_type_id
        //* Pass empty trans_number initially - will be generated just before commit
        let typeSpecificResult: {
          successResults: any[];
          errors: any[];
          auditTrailsToCreate: any[];
        };

        typeSpecificResult = await this.processRequirement(
          warehouses,
          requirement,
          calculatedTransDate,
          userId,
          accessKeyId,
          "", // Pass empty trans_number - will generate just before commit
          location_id,
          createDto.files,
          queryRunner, // Pass outer transaction queryRunner
        );

        // Merge results from type-specific processing
        successResults = typeSpecificResult.successResults;
        errors.push(...typeSpecificResult.errors);
        // auditTrailsToCreate.push(...typeSpecificResult.auditTrailsToCreate);

        let transactionType = "";
        let transFormat = "";
        if (successResults.length > 0) {
          // *** GENERATE trans_number
          if (requirement.requirement_type_id === 1) {
            transactionType = "REQUIREMENTS";
            transFormat = "R{abbr}{key}{year}-{seq:4}";
          } else {
            transactionType = `REQUIREMENTS_${requirement.requirement_type_id}_${requirement.id}`;
            transFormat = `${requirement.id}R{abbr}{key}{year}-{seq:4}`;
          }
          trans_number =
            await this.commonUtilitiesService.generateTransactionNumber({
              transaction_type: transactionType,
              location_id: location_id,
              access_key_id: accessKeyId,
              format: transFormat,
              reset_per_year: true,
              currentDate: new Date(),
              abbr: location_abbr,
            });

          // console.log("Current TS:", new Date());
          // console.log("Calculated TS:", new Date(calculatedTransDate));

          logger.debug(
            `[TRANS_NUMBER ALLOCATED] trans_number: ${trans_number} | Stores: ${successResults.length}`,
          );

          //* Update all created headers with the newly allocated trans_number
          const headerIds = successResults.map(
            (s) => s.req_transaction_header_id,
          );
          await queryRunner.manager.update(
            ReqTransactionHeader,
            { id: In(headerIds) },
            { trans_number },
          );

          logger.debug(
            `[HEADERS UPDATED] Updated ${headerIds.length} headers with trans_number: ${trans_number}`,
          );
        }

        //* Step 10: Process files with GLOBAL QUEUE-BASED CONCURRENCY control
        //* CRITICAL: Use singleton global queue to prevent 20-concurrent-user memory explosion
        //
        //* Problem without global queue:
        // - 20 users uploading = 20 local queues running in parallel
        // - Each user processes files sequentially but all users' files run together
        // - Total: 20 × 150MB Sharp = 3GB memory just for compression!
        //* Solution: Singleton global queue with concurrency: 2
        // - All users' files enter single global queue
        // - Only 2 files compress globally at a time (300MB max Sharp)
        // - Server stays stable even with 20+ concurrent users
        // - Users queue but don't crash system

        const globalQueue = GlobalFileProcessingQueueService.getInstance();
        const FILE_BATCH_SIZE = 5; // Group files into 5-file logical batch for sub-batch tracking

        const totalFiles = createDto.files.length;
        const memStart = getMemoryStats();

        // Log queue status and system RAM at batch start
        const queueMetrics = GlobalFileProcessingQueueService.getQueueMetrics();
        logger.info(
          `[BATCH START - QUEUE STATUS] trans_number: ${trans_number} | Files: ${totalFiles} | Queue: Size=${queueMetrics.queueSize}, Pending=${queueMetrics.queuePending}, Processing=${queueMetrics.filesProcessing} | System RAM: ${queueMetrics.system.usedGB}GB/${queueMetrics.system.totalGB}GB (${queueMetrics.system.usagePercent}%)`,
        );

        // logger.info(
        //   `[BATCH START] trans_number: ${trans_number} | Files: ${totalFiles} | Stores: ${successResults.length} | Global queue concurrency: 2 (max 2 files processing) | Memory: Heap=${memStart.heapUsed}MB, RSS=${memStart.rss}MB`,
        // );

        // Enhanced logging: Structured batch start logging
        this.uploadProgressLogger.logBatchStarted(
          uploadId,
          trans_number,
          successResults.length,
          totalFiles,
          {
            heapUsed: memStart.heapUsed,
            rss: memStart.rss,
          },
        );

        if (successResults.length > 0) {
          //* Add all files to global queue (will process sequentially across all users, limited to 2 concurrent)
          const fileQueue_promises = createDto.files.map((file, fileIndex) => {
            GlobalFileProcessingQueueService.onFileQueued(
              uploadId,
              fileIndex,
              totalFiles,
            );

            return globalQueue.add(async () => {
              const fileProcessStartTime = Date.now();
              GlobalFileProcessingQueueService.onFileProcessingStart(
                uploadId,
                fileIndex,
              );

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
                  filesFailedCount++;
                  return;
                }

                //* STREAMING COMPRESSION: Compress and save directly to disk (NO intermediate buffer)
                //* Memory benefit: Only N files compressed globally (via global queue, not per-user)
                //* Process: buffer → sharp/stream → disk write → freed memory → next file
                const savedFileInfo =
                  await FileUploadHandler.compressAndSaveStreamDirect(
                    file.buffer,
                    file.filename,
                    correspondingHeader.req_transaction_header_id,
                    "uploads/" +
                      process.env.UPLOAD_REQ_DIR +
                      "/" +
                      trans_number,
                  );

                //* COLLECT transaction detail DTO instead of creating immediately
                const detailDto = {
                  req_transaction_header_id:
                    correspondingHeader.req_transaction_header_id,
                  requirement_file_path: savedFileInfo.relativePath,
                  requirement_file_name: savedFileInfo.filename,
                  status_id: 1,
                };

                detailsToCreate.push(detailDto);
                filesProcessed++;

                const fileProcessTime = Date.now() - fileProcessStartTime;
                GlobalFileProcessingQueueService.onFileProcessingComplete(
                  uploadId,
                  fileIndex,
                  fileProcessTime,
                );

                //* Every FILE_BATCH_SIZE files, log sub-batch progress with queue metrics
                if (
                  (fileIndex + 1) % FILE_BATCH_SIZE === 0 ||
                  fileIndex === totalFiles - 1
                ) {
                  const subBatchMem = getMemoryStats();
                  const queueStatus =
                    GlobalFileProcessingQueueService.getQueueStatus();
                  // logger.info(
                  //   `[SUB-BATCH] ${fileIndex + 1}/${totalFiles} | Heap: ${subBatchMem.heapUsed}MB | RSS: ${subBatchMem.rss}MB | Success: ${filesProcessed} | Failed: ${filesFailedCount} | ${queueStatus}`,
                  // );

                  // Enhanced logging: Progress checkpoint with queue congestion status and memory stats
                  const queueMetrics =
                    GlobalFileProcessingQueueService.getQueueMetrics();
                  this.uploadProgressLogger.logProgressCheckpoint(
                    uploadId,
                    fileIndex + 1,
                    totalFiles,
                    filesProcessed,
                    filesFailedCount,
                    queueMetrics.avgWaitTimeMs,
                    {
                      heapUsed: subBatchMem.heapUsed,
                      rss: subBatchMem.rss,
                    },
                  );
                }
              } catch (fileError) {
                //* File processing failed - PARTIAL COMMIT APPROACH
                //* Remove from successResults so warehouse won't be committed
                //* Track file path for cleanup (delete after transaction commits)
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
                        //* Track header info for post-commit rollback (set status=5 instead of delete)
                        failedHeadersToRollback.push({
                          warehouse_id: correspondingHeader.warehouse_id,
                          req_transaction_header_id:
                            correspondingHeader.req_transaction_header_id,
                          req_transaction_due_id:
                            correspondingHeader.req_transaction_due_id,
                          filename: file.filename,
                        });

                        //* Track the file path for deletion after commit
                        //* (files written to disk but won't be committed to DB)
                        const failedFilePath = `uploads/${
                          process.env.UPLOAD_REQ_DIR
                        }/${trans_number}/${correspondingHeader.req_transaction_header_id}`;
                        failedWarehouseFilePaths.push(failedFilePath);

                        //* Remove from results - this warehouse won't be committed
                        successResults = successResults.filter(
                          (s) =>
                            s.req_transaction_header_id !==
                            correspondingHeader.req_transaction_header_id,
                        );
                      }
                    }
                  }
                } catch (filterError) {
                  const filterErr = filterError as Error;
                  logger.error(
                    `Failed to remove transaction from results for file ${file.filename}: ${filterErr.message}`,
                  );
                }

                filesFailedCount++;
                const fileProcessTime = Date.now() - fileProcessStartTime;
                GlobalFileProcessingQueueService.onFileProcessingComplete(
                  uploadId,
                  fileIndex,
                  fileProcessTime,
                );
                errors.push({
                  file: file.filename,
                  reason:
                    (fileError as Error).message || "Error processing file",
                  field: "file_processing",
                });
              }
            });
          });

          //* Wait for ALL files in global queue to complete (may need to wait for other users' files)
          await Promise.all(fileQueue_promises);
        }

        //* Cleanup: Explicit cleanup of file buffers after all processing completes
        createDto.files.forEach((f) => {
          f.buffer = null;
        });

        //* Trigger garbage collection after all files processed
        if (global.gc) {
          global.gc();
        }

        //* Step 10.5: BULK CREATE all transaction details with consolidated audit trail
        if (detailsToCreate.length > 0) {
          try {
            await this.reqTransactionDetailsService.bulkCreate(
              detailsToCreate,
              userId,
              queryRunner, // ✅ Pass queryRunner to use same transaction context
            );

            logger.info(
              `[TRANSACTION DETAILS BATCH] Bulk created ${detailsToCreate.length} req transaction details`,
            );
          } catch (bulkDetailsError) {
            const bulkErr = bulkDetailsError as Error;
            logger.error(
              `[TRANSACTION DETAILS BATCH] Error during bulk creation: ${bulkErr.message}`,
            );
            errors.push({
              transaction_details: "batch_creation",
              reason: `Failed to bulk create transaction details: ${bulkErr.message}`,
              field: "req_transaction_details",
            });
          }
        }

        //* OPTIMIZED: Batch insert ALL audit trails at once (consolidate warehouse + batch summary)
        //* This prevents multiple SSE events - only ONE event after all inserts complete
        const memEnd = getMemoryStats();
        const heapDiffTotal = (
          parseFloat(memEnd.heapUsed) - parseFloat(memStart.heapUsed)
        ).toFixed(2);
        const rssDiffTotal = (
          parseFloat(memEnd.rss) - parseFloat(memStart.rss)
        ).toFixed(2);

        const batchSummaryAuditTrail = {
          service: "ReqTransactionHeadersService",
          method: `createWithDetails (Requirement Type ${requirement.requirement_type_id} - ${requirement.requirementType.requirement_type_name})`,
          raw_data: JSON.stringify({
            trans_number,
            total_files: totalFiles,
            files_processed: filesProcessed,
            files_failed: filesFailedCount,
            total_warehouses: successResults.length,
            warehouse_ids: successResults.map((s) => s.warehouse_id),
            warehouse_names: successResults.map(
              (s) => `${s.warehouse_ifs} - ${s.warehouse_name}`,
            ),
            req_transaction_header_ids: successResults.map(
              (s) => s.req_transaction_header_id,
            ),
            requirement_id: createDto.requirement_id,
          }),
          description: `Batch transaction created - trans_number: ${trans_number} | Files: ${filesProcessed}/${totalFiles} successful | Stores: ${successResults.length} | Headers: ${successResults.length} | Heap peak: ${heapDiffTotal}MB | RSS peak: ${rssDiffTotal}MB`,
          status_id: 1,
        };

        // Add batch summary as final audit trail entry
        auditTrailsToCreate.push(batchSummaryAuditTrail);

        // BATCH INSERT: Delegate to audit trail service for consolidated insertion
        if (auditTrailsToCreate.length > 0) {
          await this.userAuditTrailCreateService.bulkCreate(
            auditTrailsToCreate,
            userId,
          );
        }

        // const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(
        //   2,
        // );
        // const finalQueueMetrics =
        //   GlobalFileProcessingQueueService.getQueueMetrics();
        // logger.info(
        //   `[BATCH COMPLETE] trans_number: ${trans_number} | Files: ${filesProcessed}/${totalFiles} | Stores: ${successResults.length} | Heap: ${memEnd.heapUsed}MB (Δ ${heapDiffTotal}MB) | RSS: ${memEnd.rss}MB (Δ ${rssDiffTotal}MB) | Duration: ${uploadDuration}s | Global Queue: Size=${finalQueueMetrics.queueSize}, Pending=${finalQueueMetrics.queuePending} | System RAM: ${finalQueueMetrics.system.usedGB}GB/${finalQueueMetrics.system.totalGB}GB (${finalQueueMetrics.system.usagePercent}%)`,
        // );

        // Enhanced logging: Structured batch completion with memory and queue summary
        this.uploadProgressLogger.logBatchCompleted(
          uploadId,
          trans_number,
          totalFiles,
          filesProcessed,
          filesFailedCount,
          Date.now() - uploadStartTime,
          parseFloat(heapDiffTotal),
          parseFloat(rssDiffTotal),
          {
            heapUsed: memEnd.heapUsed,
            rss: memEnd.rss,
          },
        );

        //* Step 11: Build consolidated response
        const message =
          successResults.length > 0
            ? filesFailedCount > 0
              ? `Successfully created ${successResults.length} transaction(s), ${filesFailedCount} warehouse(s) failed`
              : `Successfully created ${successResults.length} transaction(s)`
            : `No transactions created`;
        const response = {
          success: {
            warehouse_ids: successResults.map((s) => s.warehouse_id),
            warehouse_names: successResults.map((s) => s.warehouse_name),
            req_transaction_header_ids: successResults.map(
              (s) => s.req_transaction_header_id,
            ),
            trans_number,
            req_transaction_header_count: successResults.length,
            message: message,
          },
          errors: errors,
        };

        if (successResults.length > 0) {
          // Clear req transaction caches (DRY: SSE + cache invalidation)
          await this.cacheInvalidationService.invalidateReqTransactions();
          await this.cacheInvalidationService.invalidateWarehouseRequirements();
          await this.cacheInvalidationService.invalidateRequirements();

          // OPTIMIZED: Emit SSE event ONCE per batch completion (debounced)
          // Instead of per-file SSE events, emit single event after all files processed
          try {
            this.sseEventEmitter.emitCreateSignal("req_transactions", 0);
            logger.info(
              `[SSE BROADCAST] Emitted single event for batch completion - trans_number: ${trans_number}`,
            );
          } catch (err) {
            logger.error("SSE event failed:", err);
          }
        }

        // ✅ PARTIAL COMMIT: Only commit successful warehouses (those still in successResults)
        // Failed warehouses already filtered out - they'll be cancelled post-commit
        // *** COMMIT TRANSACTION - Only successful warehouses persist ***
        await queryRunner.commitTransaction();
        logger.info(
          `[TRANSACTION COMMITTED] trans_number: ${trans_number} | Successful warehouses: ${successResults.length} | Failed warehouses: ${filesFailedCount} | Headers to cancel: ${failedHeadersToRollback.length}`,
        );

        // ✅ POST-COMMIT: Cancel failed warehouse headers (set status_id = 5, keep for audit trail)
        // Create new query runner for separate transaction
        if (failedHeadersToRollback.length > 0) {
          const postCommitQueryRunner =
            this.reqTransactionHeadersRepository.manager.connection.createQueryRunner();
          await postCommitQueryRunner.connect();
          await postCommitQueryRunner.startTransaction();

          try {
            for (const failedHeader of failedHeadersToRollback) {
              await this.rollbackWarehouseTransaction(
                failedHeader,
                userId,
                postCommitQueryRunner,
              );
              logger.info(
                `[POST-COMMIT ROLLBACK] Cancelled header ${failedHeader.req_transaction_header_id} for warehouse ${failedHeader.warehouse_id}`,
              );
            }

            await postCommitQueryRunner.commitTransaction();
            logger.info(
              `[POST-COMMIT TRANSACTION COMMITTED] Cancelled ${failedHeadersToRollback.length} failed warehouse headers`,
            );

            // ✅ Log post-commit rollback to audit trail
            await this.userAuditTrailCreateService.create(
              {
                service: "ReqTransactionHeadersService",
                method: "createWithDetails (post-commit rollback)",
                raw_data: JSON.stringify({
                  trans_number,
                  failed_warehouse_count: failedHeadersToRollback.length,
                  failed_header_ids: failedHeadersToRollback.map(
                    (h) => h.req_transaction_header_id,
                  ),
                  failed_files: failedHeadersToRollback.map((h) => h.filename),
                }),
                description: `Post-commit rollback: Cancelled ${failedHeadersToRollback.length} warehouse transaction(s) due to file processing failures. Headers marked as status 5 (Cancelled).`,
                status_id: 1,
              },
              userId,
            );
          } catch (postCommitError) {
            await postCommitQueryRunner.rollbackTransaction();
            const postErr = postCommitError as Error;
            logger.error(
              `[POST-COMMIT ROLLBACK FAILED] Error cancelling headers: ${postErr.message}`,
            );
          } finally {
            await postCommitQueryRunner.release();
          }
        }

        // ✅ POST-COMMIT CLEANUP: Delete orphaned files for failed warehouses
        // These files were written to disk but have no corresponding details
        if (failedWarehouseFilePaths.length > 0) {
          try {
            for (const failedFilePath of failedWarehouseFilePaths) {
              try {
                const fullPath = path.join(process.cwd(), failedFilePath);

                // Check if path exists before attempting deletion
                try {
                  const stats = await fs.stat(fullPath);

                  // If it's a directory, recursively delete it
                  if (stats.isDirectory()) {
                    await fs.rm(fullPath, { recursive: true, force: true });
                    logger.info(
                      `[CLEANUP] Deleted orphaned directory: ${failedFilePath}`,
                    );
                  } else {
                    // If it's a file, delete it
                    await fs.unlink(fullPath);
                    logger.info(
                      `[CLEANUP] Deleted orphaned file: ${failedFilePath}`,
                    );
                  }
                } catch (statErr) {
                  // Path doesn't exist - that's OK, no need to delete
                  const sErr = statErr as Error;
                  if (
                    sErr.message.includes("ENOENT") ||
                    sErr.message.includes("no such file or directory")
                  ) {
                    logger.debug(
                      `[CLEANUP] Orphaned path already deleted or never created: ${failedFilePath}`,
                    );
                  } else {
                    logger.warn(
                      `[CLEANUP] Error checking path ${failedFilePath}: ${sErr.message}`,
                    );
                  }
                }
              } catch (deleteErr) {
                const delErr = deleteErr as Error;
                logger.warn(
                  `[CLEANUP] Failed to delete orphaned path ${failedFilePath}: ${delErr.message}`,
                );
              }
            }
          } catch (cleanupErr) {
            const cleanErr = cleanupErr as Error;
            logger.error(
              `[CLEANUP] Error during file cleanup: ${cleanErr.message}`,
            );
          }
        }

        return response;
      } catch (transactionError) {
        // Rollback entire transaction if ANY operation fails
        await queryRunner.rollbackTransaction();
        const transErr = transactionError as Error;
        logger.error(
          `[TRANSACTION ROLLBACK] Operation failed, entire transaction rolled back: ${transErr.message}`,
          transErr.stack,
        );

        // Re-throw for outer catch to handle
        throw transactionError;
      } finally {
        // Release query runner resources
        await queryRunner.release();
        logger.info(`[QUERY RUNNER RELEASED] Transaction cleanup completed`);
      }
    } catch (error) {
      // Extract detailed error message for user feedback
      let errorMessage = "Unknown error in transaction creation";

      if (error instanceof BadRequestException) {
        // Already a formatted error - throw as-is
        throw error;
      }

      if (error instanceof Error) {
        errorMessage = error.message;

        // Try to extract more detail from TypeORM/Database errors
        if ("originalError" in error) {
          const originalError = (error as any).originalError;
          if (originalError?.message) {
            errorMessage = originalError.message;
          }
        }
      }

      // Log the detailed error for debugging
      logger.error(
        `[TRANSACTION CREATION FAILED] Error: ${errorMessage}`,
        error instanceof Error ? error.stack : String(error),
      );

      // Save to sync log for audit
      await this.syncLogRepository.save({
        module: "ReqTransactionHeadersService",
        type: "createWithDetails",
        action: "error",
        message: errorMessage,
        row_data: JSON.stringify({
          warehouse_ids: createDto.warehouse_ids,
          requirement_id: createDto.requirement_id,
          error_type:
            error instanceof Error ? error.constructor.name : typeof error,
        }),
      });

      // ✅ Return consistent response structure (not 400 error) so frontend can parse it uniformly
      return {
        success: {
          warehouse_ids: [],
          warehouse_names: [],
          req_transaction_header_ids: [],
          req_transaction_header_count: 0,
          message: `Transaction creation failed`,
        },
        errors: [
          {
            reason: errorMessage,
            field: "transaction_creation",
          },
        ],
      };
    } finally {
      // Decrement concurrent upload counter
      ReqTransactionHeadersService.concurrentUploads--;
      const memFinal = getMemoryStats();
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      const uploadCompletedQueueMetrics =
        GlobalFileProcessingQueueService.getQueueMetrics();
      // logger.info(
      //   `[UPLOAD COMPLETED] ID: ${uploadId} | Concurrent uploads: ${ReqTransactionHeadersService.concurrentUploads} | Memory: Heap=${memFinal.heapUsed}MB, RSS=${memFinal.rss}MB | Duration: ${uploadDuration}s | Global Queue: Size=${uploadCompletedQueueMetrics.queueSize}, Pending=${uploadCompletedQueueMetrics.queuePending}, Processing=${uploadCompletedQueueMetrics.filesProcessing}`,
      // );

      // Enhanced logging: Structured upload completion and active summary
      this.uploadProgressLogger.logUploadCompleted(
        uploadId,
        trans_number,
        createDto.files.length,
        filesProcessed,
        filesFailedCount,
        uploadDuration,
        {
          heapUsed: memFinal.heapUsed,
          rss: memFinal.rss,
        },
      );

      // Log active uploads summary if there are still active uploads
      if (this.uploadProgressLogger.getActiveUploadCount() > 0) {
        this.uploadProgressLogger.logActiveSummary();
      }
    }
  }
}
