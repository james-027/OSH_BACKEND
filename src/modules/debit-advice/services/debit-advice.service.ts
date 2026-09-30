import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Transaction, In } from "typeorm";
import { DebitAdvice_header } from "../../../entities/DebitAdviceHeader";
import { DebitAdviceLine } from "src/entities/DebitAdviceItems";
import { DebitAdviceGLItems } from "src/entities/DebitAdviceGLItems";
import { CreateDebitAdviceDto } from "../dto/CreateDebitAdviceDto";
import { UpdateDebitAdviceDto } from "../dto/UpdateDebitAdviceDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import logger from "../../../config/logger";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { formatDateToString } from "src/utils/date.utils";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { TransactionAttachment } from "src/entities/TransactionAttachment";
import { Inject } from "@nestjs/common";
import * as fs from "fs";
import { Brackets } from "typeorm";
import * as path from "path";
import { ApprovalMatrixService } from "src/modules/approval-matrix/services/approval-matrix.service";
import { ApprovalLogsService } from "src/modules/approval-logs/services/approval-logs.service";
import { EmailQueueService } from "src/modules/email-queue/services/email-queue.service";
import { Module } from "src/entities/Module";
import { OSHJVService } from "./jv-creation.service";
import { Supplier } from "src/entities/Supplier";
import { GLAccounts } from "src/entities/GLAccounts";
// This is for the main service file for debit advice. It will contain the business logic for handling debit advice operations such as
// create, read, update, and delete. The service will interact with the database through the repository and also handle any necessary
// transformations or validations before returning the response to the controller. Additionally, it will log audit trails for create
// and update operations to keep track of changes made to the debit advice records.

@Injectable()
export class DebitAdviceService {
  constructor(
    private readonly emailQueueService: EmailQueueService,
    private readonly approvalMatrixService: ApprovalMatrixService,
    private readonly approvalLogsService: ApprovalLogsService,
    private readonly oshJvService: OSHJVService,
    @InjectRepository(DebitAdvice_header)
    private debitAdviceRepository: Repository<DebitAdvice_header>,
    @InjectRepository(DebitAdviceLine)
    private debitAdviceLineRepository: Repository<DebitAdviceLine>,
    @InjectRepository(DebitAdviceGLItems)
    private debitAdviceGLItemsRepository: Repository<DebitAdviceGLItems>,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private commonUtilitiesService: CommonUtilitiesService,
    private sseEventEmitter: SSEEventEmitterHelper,
    @Inject(ActionLogsService)
    private ActionLogsService: ActionLogsService,
    @InjectRepository(TransactionAttachment)
    private readonly attachmentRepository: Repository<TransactionAttachment>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Supplier)
    private supplierRepository: Repository<Supplier>,
    @InjectRepository(GLAccounts)
    private glAccountRepository: Repository<GLAccounts>,
  ) {}

  private readonly module_name = "DEBIT ADVICE";
  // Get all debit advices
  async findAll(): Promise<any[]> {
    try {
      const debitAdvices = await this.debitAdviceRepository.find({
        relations: ["status", "createdBy", "lines", "lines.glItems"],
        order: {
          id: "ASC",
          lines: {
            id: "ASC",
          },
        },
      });

      return debitAdvices.map((item) => ({
        id: item.id,
        document_number: item.document_number,
        transaction_date: item.transaction_date,
        status_id: item.status_id,
        status_name: item.status ? item.status.status_name : null,
        created_at: item.created_at,
        updated_at: item.updated_at,
        jv_no: item.jv_no,
        remarks: item.remarks,
        location_id: item.location_id,
        approval: item.approval,
        requestor_id: item.requestor_id,
        created_user: item.createdBy
          ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
          : null,
        // // ✅ include GL items inside each line
        // lines_items: (item.lines || []).map(line => ({
        //     ...line,
        // })),
      }));
      // return this.responseMapperService.mapEntitiesToResponse(debitAdvices);
    } catch (error) {
      logger.error("Error fetching debit advices:", error);
      throw new Error("Failed to fetch debit advices");
    }
  }

  async findAllConfirmation(): Promise<any[]> {
    try {
      const debitAdvices = await this.debitAdviceRepository.find({
        // Add the where clause here
        where: {
          status_id: 7,
        },
        relations: ["status", "createdBy", "lines", "lines.glItems"],
        order: {
          id: "ASC",
          lines: {
            id: "ASC",
          },
        },
      });

      return debitAdvices.map((item) => ({
        id: item.id,
        document_number: item.document_number,
        transaction_date: item.transaction_date,
        status_id: item.status_id,
        status_name: item.status ? item.status.status_name : null,
        created_at: item.created_at,
        updated_at: item.updated_at,
        jv_no: item.jv_no,
        remarks: item.remarks,
        location_id: item.location_id,
        approval: item.approval,
        requestor_id: item.requestor_id,
        created_user: item.createdBy
          ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
          : null,
        // ✅ include GL items inside each line
        lines_items: (item.lines || []).map((line) => ({
          ...line,
        })),
      }));
    } catch (error) {
      logger.error("Error fetching debit advices:", error);
      throw new Error("Failed to fetch debit advices");
    }
  }

  async findOneHistory(ref_id: number) {
    // const module_id = 34; // DEBIT ADVICES
    return this.ActionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

  // Get single debit advice by ID
  async findOne(id: number): Promise<any> {
    try {
      const debitAdvice = await this.debitAdviceRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "lines", "lines.glItems"],
      });
      if (!debitAdvice) {
        throw new NotFoundException(`Debit advice with ID ${id} not found`);
      }
      return {
        document_number: debitAdvice.document_number,
        transaction_date: debitAdvice.transaction_date,
        id: debitAdvice.id,
        status_id: debitAdvice.status_id,
        status_name: debitAdvice.status ? debitAdvice.status.status_name : null,
        created_at: debitAdvice.created_at,
        updated_at: debitAdvice.updated_at,
        jv_no: debitAdvice.jv_no,
        remarks: debitAdvice.remarks,
        location_id: debitAdvice.location_id,
        approval: debitAdvice.approval,
        requestor_id: debitAdvice.requestor_id,
        created_user: debitAdvice.createdBy
          ? `${debitAdvice.createdBy.first_name} ${debitAdvice.createdBy.last_name}`
          : null,
        // ✅ include GL items inside each line
        lines_items: (debitAdvice.lines || []).map((line) => ({
          ...line,
        })),
      };
      // return this.responseMapperService.mapEntityToResponse(debitAdvice);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error fetching debit advice:", error);
      throw new Error("Failed to fetch debit advice");
    }
  }
  async findBulk(ids: number[]): Promise<any[]> {
    try {
      const debitAdvices = await this.debitAdviceRepository.find({
        where: {
          id: In(ids),
        },
        relations: ["status", "createdBy", "lines", "lines.glItems"],
        order: {
          id: "ASC",
          lines: {
            id: "ASC",
          },
        },
      });

      return debitAdvices.map((debitAdvice) => ({
        document_number: debitAdvice.document_number,
        transaction_date: debitAdvice.transaction_date,
        id: debitAdvice.id,
        status_id: debitAdvice.status_id,
        status_name: debitAdvice.status ? debitAdvice.status.status_name : null,
        created_at: debitAdvice.created_at,
        updated_at: debitAdvice.updated_at,
        jv_no: debitAdvice.jv_no,
        remarks: debitAdvice.remarks,
        location_id: debitAdvice.location_id,
        approval: debitAdvice.approval,
        requestor_id: debitAdvice.requestor_id,
        created_user: debitAdvice.createdBy
          ? `${debitAdvice.createdBy.first_name} ${debitAdvice.createdBy.last_name}`
          : null,
        lines_items: (debitAdvice.lines || []).map((line) => ({
          ...line,
        })),
      }));
    } catch (error) {
      logger.error("Error fetching debit advices in bulk:", error);
      throw new Error("Failed to fetch debit advices in bulk");
    }
  }
  // Create new debit advice
  async create(
    createDebitAdviceDto: CreateDebitAdviceDto,
    userId: number,
    accessKeyId: number,
    docno: string,
    roleId?: number,
  ): Promise<any> {
    let savedDebitAdvice: any;
    try {
      console.log("createDebitAdviceDto", createDebitAdviceDto);
      let trans_number = "";
      let location_id: number | null = 1;
      let location_abbr: string | null = null;
      const year = parseInt(
        createDebitAdviceDto.transaction_date.toString(),
        10,
      );
      const quarterMonth = (createDebitAdviceDto.quarter - 1) * 3 + 1;
      const transDate = new Date(year, quarterMonth - 1, 1);
      const calculatedTransDate = formatDateToString(transDate);

      // Check if debit advice already exists checking of docno
      const existingDebitAdvice = await this.debitAdviceRepository.findOne({
        where: { document_number: createDebitAdviceDto.document_number },
      });
      if (existingDebitAdvice) {
        throw new BadRequestException("Debit advice already exists");
      }

      //* for document No
      trans_number =
        await this.commonUtilitiesService.generateTransactionNumber({
          transaction_type: "DEBIT ADVICE",
          location_id: location_id,
          vendor_id: 0,
          access_key_id: accessKeyId,
          format: "D{abbr}{key}{year}-{seq:5}",
          reset_per_year: true,
          currentDate: new Date(calculatedTransDate),
          abbr: location_abbr,
        });

      // Create debit advice
      const newDebitAdvice = this.debitAdviceRepository.create({
        createdBy: { id: userId } as any,
        document_number: trans_number,
        transaction_date: createDebitAdviceDto.transaction_date,
        status_id: createDebitAdviceDto.status_id ?? 17,
        remarks: createDebitAdviceDto.remarks,
        location_id: createDebitAdviceDto.location_id,
        approval: createDebitAdviceDto.approval,
        requestor_id: createDebitAdviceDto.requestor_id ?? 0,
        lines: createDebitAdviceDto.line.map((item) => ({
          ...item,
          createdBy: { id: userId } as any,
          ref_docno: trans_number,
          glItems: (item.glItems || []).map((data) => ({
            ...data,
            createdBy: { id: userId } as any,
            ref_docno: trans_number,
          })),
        })),
      });
      savedDebitAdvice = await this.debitAdviceRepository.save(newDebitAdvice);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("debit-advices", savedDebitAdvice.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      // Reload relations after save
      const reloadedDebitAdvice = await this.debitAdviceRepository.findOne({
        where: { id: savedDebitAdvice.id },
        relations: ["status", "createdBy", "lines", "lines.glItems"],
      });

      // Action log
      await this.ActionLogsService.logAction({
        action_id: 1, // add
        ref_id: reloadedDebitAdvice.id,
        module_name: this.module_name,
        description: `Created debit advice with document number ${reloadedDebitAdvice.document_number}`,
        raw_data: JSON.stringify(reloadedDebitAdvice),
        created_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICES",
          method: "create",
          raw_data: JSON.stringify(reloadedDebitAdvice),
          description: `Created debit advice: ${createDebitAdviceDto.id}`,
          status_id: reloadedDebitAdvice.status_id,
        },
        userId,
      );

      // return this.responseMapperService.mapEntityToResponse(savedDebitAdvice);
      return {
        id: reloadedDebitAdvice.id,
        status_id: reloadedDebitAdvice.status_id,
        status_name: reloadedDebitAdvice.status?.status_name || null,
        created_at: reloadedDebitAdvice.created_at,
        document_number: reloadedDebitAdvice.document_number,
        Transaction_date: reloadedDebitAdvice.transaction_date,
        jv_no: reloadedDebitAdvice.jv_no,
        remarks: reloadedDebitAdvice.remarks,
        approval: reloadedDebitAdvice.approval,
        requestor_id: reloadedDebitAdvice.requestor_id,
        location_id: reloadedDebitAdvice.location_id,
        created_user: reloadedDebitAdvice.createdBy
          ? `${reloadedDebitAdvice.createdBy.first_name} ${reloadedDebitAdvice.createdBy.last_name}`
          : null,
        // ✅ include GL items inside each line
        lines_items: (reloadedDebitAdvice.lines || []).map((line) => ({
          ...line,
        })),
      };
    } catch (error) {
      if (savedDebitAdvice && savedDebitAdvice.id) {
        await this.rollbackWarehouseTransaction(savedDebitAdvice);
      } else {
        logger.warn(
          "No debit advice to rollback - error occurred before save or save failed",
        );
      }
      logger.error("Error creating debit advice:", error);
      throw error;
    }
  }
  // Update debit advice
  async update(
    docno: string,
    updateDebitAdviceDto: UpdateDebitAdviceDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    let updatedDebitAdvice: any;
    try {
      const debitAdvice = await this.debitAdviceRepository.findOne({
        where: { document_number: docno },
      });
      if (!debitAdvice) {
        throw new NotFoundException(
          `Debit advice with document number ${docno} not found`,
        );
      }
      const current_status_id = debitAdvice.status_id;
      // Update header
      Object.assign(debitAdvice, updateDebitAdviceDto, { updated_by: userId });
      updatedDebitAdvice = await this.debitAdviceRepository.save(debitAdvice);

      // Update line items
      if (updateDebitAdviceDto.line && updateDebitAdviceDto.line.length > 0) {
        for (const lineItemDto of updateDebitAdviceDto.line) {
          let lineItem: DebitAdviceLine;
          if (lineItemDto.id) {
            // Update existing line item
            lineItem = await this.debitAdviceLineRepository.findOne({
              where: { id: lineItemDto.id },
            });
            if (lineItem) {
              if (lineItemDto.isdeleted == 1 && lineItem) {
                // 1. delete child records FIRST
                await this.debitAdviceGLItemsRepository.delete({
                  debitAdviceLine: { id: lineItem.id },
                });
                await this.debitAdviceLineRepository.delete(lineItem.id);
                continue;
              } else {
                Object.assign(lineItem, lineItemDto, { updated_by: userId });
                await this.debitAdviceLineRepository.save(lineItem);
              }

              //  Update or create GL items for this line item
              if (lineItemDto.glItems && lineItemDto.glItems.length > 0) {
                for (const glItemDto of lineItemDto.glItems) {
                  let glItem: DebitAdviceGLItems;
                  if (glItemDto.id) {
                    // Update existing GL item
                    glItem = await this.debitAdviceGLItemsRepository.findOne({
                      where: { id: glItemDto.id },
                    });
                    if (glItem) {
                      if (glItemDto.isdeleted == 1) {
                        // Soft delete: mark as deleted
                        await this.debitAdviceGLItemsRepository.delete({
                          id: glItemDto.id,
                        });
                      } else {
                        Object.assign(glItem, glItemDto, {
                          updated_by: userId,
                          ref_docno: docno,
                        });
                        await this.debitAdviceGLItemsRepository.save(glItem);
                      }
                    }
                  } else {
                    // Create new GL item
                    glItem = this.debitAdviceGLItemsRepository.create({
                      ...glItemDto,
                      debitAdviceLine: lineItem,
                      createdBy: { id: userId } as any,
                      ref_docno: docno,
                    });
                    await this.debitAdviceGLItemsRepository.save(glItem);
                  }
                }
              }
            }
          } else {
            // Create new line item
            lineItem = this.debitAdviceLineRepository.create({
              ...lineItemDto,
              header: debitAdvice,

              createdBy: { id: userId } as any,
              ref_docno: debitAdvice.document_number,
            });
            await this.debitAdviceLineRepository.save(lineItem);
          }
        }
      }

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("debit-advices", updatedDebitAdvice.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      const reloadedDebitAdvice = await this.debitAdviceRepository.findOne({
        where: { id: updatedDebitAdvice.id },
        relations: ["status", "createdBy", "lines"],
      });

      let action_id = 1;
      let description = ``;

      if (reloadedDebitAdvice.status_id === current_status_id) {
        action_id = 2; // EDIT
        switch (reloadedDebitAdvice.status_id) {
          case 17:
            description = `Edit Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
            break;
        }
      } else if (
        reloadedDebitAdvice.status_id === 3 ||
        (reloadedDebitAdvice.status_id === 17 && current_status_id !== 7)
      ) {
        action_id = 1; // ADD
        description = `Add New Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      } else if (reloadedDebitAdvice.status_id === 4) {
        action_id = 4; // Posting
        description = `Post Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      } else if (reloadedDebitAdvice.status_id === 7) {
        action_id = 7; // Approve
        description = `Approve Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      } else if (reloadedDebitAdvice.status_id === 14) {
        action_id = 6; // Deactivate
        description = `Deactivate Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      } else if (
        reloadedDebitAdvice.status_id === 17 &&
        current_status_id === 7
      ) {
        action_id = 2;
        description = `Return to Maker Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      }

      // Action log
      await this.ActionLogsService.logAction({
        action_id: action_id, // add
        ref_id: reloadedDebitAdvice.id,
        module_name: this.module_name,
        description: description,
        raw_data: JSON.stringify(reloadedDebitAdvice),
        created_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICES",
          method: reloadedDebitAdvice.status?.status_name || "Unknown",
          raw_data: JSON.stringify(reloadedDebitAdvice),
          description: `Updated debit advice: ${reloadedDebitAdvice.document_number}`,
          status_id: reloadedDebitAdvice.status_id,
        },
        userId,
      );

      // Queue email only when status changes
      if (current_status_id !== reloadedDebitAdvice.status_id) {
        // Pending for Approval -> Approvers
        // Pending for Approval -> Approvers
        if (reloadedDebitAdvice.status_id === 3) {
          // Look up module by name
          const module = await this.moduleRepository.findOne({
            where: {
              module_name: this.module_name,
              status_id: 1,
            },
          });

          if (!module) {
            throw new NotFoundException(
              `Module '${this.module_name}' not found`,
            );
          }

          await this.emailQueueService.enqueue({
            document_number: reloadedDebitAdvice.document_number,
            transaction_id: reloadedDebitAdvice.id,
            module_id: module.id,
            trigger_status_id: 3,
            created_by: userId,
            email_subject: `[${this.module_name}] PENDING FOR APPROVAL`,
          });
        }

        // Posted -> Finance Confirmation
        // Posted -> Finance Confirmation
        if (reloadedDebitAdvice.status_id === 4) {
          // Look up module by name
          const module = await this.moduleRepository.findOne({
            where: {
              module_name: "FINANCE CONFIRMATION",
              status_id: 1,
            },
          });

          if (!module) {
            throw new NotFoundException(
              "Module 'FINANCE CONFIRMATION' not found",
            );
          }

          await this.emailQueueService.enqueue({
            document_number: reloadedDebitAdvice.document_number,
            transaction_id: reloadedDebitAdvice.id,
            module_id: module.id,
            trigger_status_id: 4,
            created_by: userId,
            email_subject: `[${this.module_name}] POSTED`,
          });
        }
      }
      return {
        id: reloadedDebitAdvice.id,
        status_id: reloadedDebitAdvice.status_id,
        status_name: reloadedDebitAdvice.status?.status_name || null,
        created_at: reloadedDebitAdvice.created_at,
        updated_at: reloadedDebitAdvice.updated_at,
        document_number: reloadedDebitAdvice.document_number,
        transaction_date: reloadedDebitAdvice.transaction_date,
        jv_no: reloadedDebitAdvice.jv_no,
        remarks: reloadedDebitAdvice.remarks,
        approval: reloadedDebitAdvice.approval,
        location_id: reloadedDebitAdvice.location_id,
        requestor_id: reloadedDebitAdvice.requestor_id,
        created_user: reloadedDebitAdvice.createdBy
          ? `${reloadedDebitAdvice.createdBy.first_name} ${reloadedDebitAdvice.createdBy.last_name}`
          : null,
        lines_items: (reloadedDebitAdvice.lines || []).map((line) => ({
          ...line,
        })),
      };
    } catch (error) {
      await this.rollbackWarehouseTransaction(updatedDebitAdvice);
      logger.error("Error updating debit advice:", error);
      throw error;
    }
  }
  // Delete debit advice (soft delete via status)
  async delete(docno: string, userId: number): Promise<any> {
    try {
      const debitAdvice = await this.debitAdviceRepository.findOne({
        where: { document_number: docno },
      });
      if (!debitAdvice) {
        throw new NotFoundException(
          `Debit advice with document number ${docno} not found`,
        );
      }

      await this.debitAdviceGLItemsRepository.delete({ ref_docno: docno });
      await this.debitAdviceLineRepository.delete({ ref_docno: docno });
      await this.debitAdviceRepository.delete({ document_number: docno });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "DEBIT_ADVICES",
          method: "DELETE",
          raw_data: JSON.stringify(debitAdvice),
          description: `Deleted debit advice: ${debitAdvice.document_number}`,
          status_id: 14,
        },
        userId,
      );
      return { success: true, message: "Debit advice deleted successfully" };
    } catch (error) {
      logger.error("Error deleting debit advice:", error);
      throw error;
    }
  }

  private async rollbackWarehouseTransaction(header: any) {
    try {
      // Delete header
      await this.debitAdviceRepository.delete(header.id);
      // Delete line items
      await this.debitAdviceLineRepository.delete({ header_id: header.id });

      // Delete GL items
      await this.debitAdviceGLItemsRepository.delete({
        ref_docno: header.document_number,
      });

      return { success: true, message: "Rollback successful" };
    } catch (rollbackError) {
      logger.error("Rollback failed:", rollbackError);
    }
  }

  async uploadExcelDebitAdvices(
    filePath: string,
    userId: number,
    roleId?: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");
    const workbook = XLSX.read(fs.readFileSync(filePath), {
      type: "buffer",
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: { row: number; error: string }[] = [];
    const success: any[] = [];
    let inserted_count = 0;
    let updated_count = 0;

    const groupedDocuments: Record<string, any> = {};

    // Same filter the frontend applies: active matrix lines belonging to this user.
    const approvalMatrices = await this.approvalMatrixService.findAll();
    const userApprovalLines = approvalMatrices.flatMap(
      (matrix: any) =>
        matrix.lines?.filter(
          (line: any) => Number(line.userid) === userId && line.status_id === 1,
        ) ?? [],
    );
    // The line id used as the `approval` value on each document (0 = none).
    // console.log("userApprovalLines", userApprovalLines);
    const defaultApprovalId = userApprovalLines[0]?.id ?? 0;
    // console.log(defaultApprovalId);

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      try {
        const sequence = row["SEQUENCE"];

        if (!sequence) {
          errors.push({
            row: index + 2,
            error: "SEQUENCE is required",
          });
          continue;
        }

        const amount = Number(row["AMOUNT"]);

        if (isNaN(amount)) {
          errors.push({
            row: index + 2,
            error: "Invalid AMOUNT",
          });
          continue;
        }

        if (!groupedDocuments[sequence]) {
          groupedDocuments[sequence] = {
            id: 0,
            document_number: "0",
            transaction_date: formatExcelDate(row["TRANSACTION DATE"]),
            status_id: 3,
            quarter: 1,
            remarks: row["DOCUMENT REMARKS"] ?? "",
            location_id: Number(row["LOCATION"]) ?? 0,
            approval: defaultApprovalId,
            createdBy: { id: userId } as any,
            requestor_id: userId,
            line: [],
          };
        }

        groupedDocuments[sequence].line.push({
          vendor_code: row["SUPPLIER CODE"],
          vendor_name: row["SUPPLIER NAME"],
          category: row["CATEGORY CODE"],
          amount,
          particulars: row["REASON"],
          glItems: [
            {
              gl_code: row["GL CODE"] ?? "-",
              gl_description: row["GL DESCRIPTION"] ?? "-",
              profitcenter_code: row["PROFIT CENTER CODE"] ?? "-",
              amount,
              Remarks: row["REASON"] ?? "-",
            },
          ],
        });
      } catch (err) {
        errors.push({
          row: index + 2,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // SAVE DOCUMENTS
    for (const sequence of Object.keys(groupedDocuments)) {
      const document = groupedDocuments[sequence];
      try {
        const createdDebitAdvice = await this.create(
          document,
          userId,
          accessKeyId,
          document.document_number,
        );
        inserted_count++;
        inserted_row_numbers.push(document.rowNum);
        success.push({
          __rowNum__: inserted_count,
          SEQUENCE: sequence,
          DESTRIPTION: `Successfully inserted document with SEQUENCE ${sequence}`,
          "TRANSACTION DATE": createdDebitAdvice.Transaction_date,
          AMOUNT: document.line?.[0]?.amount ?? 0,
          REASON: document.line?.[0]?.reason ?? "",
          ID: createdDebitAdvice.id,
          DOCUMENT_NUMBER: createdDebitAdvice.document_number,
          STATUS_NAME: createdDebitAdvice.status_name,
          STATUS: "Inserted",
          id: createdDebitAdvice.id,
        });

        // Create a new debit advice and get the default approval ID for the user
        // Reload relations after save
        const reloadedDebitAdvice = await this.debitAdviceRepository.findOne({
          where: { id: createdDebitAdvice.id },
          relations: ["status", "createdBy", "lines", "lines.glItems"],
        });

        // Initialize approval stages for this debit advice
        // Look up module by name
        const module = await this.moduleRepository.findOne({
          where: {
            module_name: this.module_name,
            status_id: 1,
          },
        });

        if (!module) {
          throw new NotFoundException(`Module '${this.module_name}' not found`);
        }

        await this.approvalLogsService.initialize(
          {
            transaction_id: reloadedDebitAdvice.id,
            module_id: module.id,
            document_number: reloadedDebitAdvice.document_number,
            transaction_date: reloadedDebitAdvice.transaction_date,
            approval_id: defaultApprovalId,
            requestor_id: reloadedDebitAdvice.requestor_id,
          },
          userId,
        );

        // Queue email only when status is Pending for Approval
        if (reloadedDebitAdvice.status_id === 3) {
          await this.emailQueueService.enqueue({
            document_number: reloadedDebitAdvice.document_number,
            transaction_id: reloadedDebitAdvice.id,
            module_id: module.id,
            trigger_status_id: 3,
            created_by: userId,
            email_subject: `[${this.module_name}] PENDING FOR APPROVAL`,
          });
        }
      } catch (err) {
        errors.push({
          row: document.rowNum,
          error: `Failed saving sequence ${sequence}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    // Delete the file after processing
    // fs.unlinkSync(filePath);

    if (inserted_count > 0 || updated_count > 0) {
      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("debit-advices", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }

    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
  /// Sakes Collection and Inventory/ Sales Collection & Inventory Upload
  async uploadExcelSalesDebitAdvices(
    filePath: string,
    userId: number,
    roleId?: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");

    const workbook = XLSX.read(fs.readFileSync(filePath), {
      type: "buffer",
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
    });
    const getExcelValue = (row: any, columnName: string) => {
      const actualKey = Object.keys(row).find(
        (key) => key.trim().toUpperCase() === columnName.trim().toUpperCase(),
      );

      return actualKey ? row[actualKey] : null;
    };
    const inserted_row_numbers: number[] = [];
    const created_documents: any[] = [];
    const updated_row_numbers: number[] = [];
    const errors: { row: number; error: string }[] = [];
    const success: any[] = [];

    let inserted_count = 0;
    let updated_count = 0;

    const groupedDocuments: Record<string, any> = {};

    // Same filter the frontend applies: active matrix lines belonging to this user.
    const approvalMatrices = await this.approvalMatrixService.findAll();

    const userApprovalLines = approvalMatrices.flatMap(
      (matrix: any) =>
        matrix.lines?.filter(
          (line: any) => Number(line.userid) === userId && line.status_id === 1,
        ) ?? [],
    );

    // The line id used as the `approval` value on each document (0 = none).
    const defaultApprovalId = userApprovalLines[0]?.id ?? 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      try {
        /*
         * New Sales & Collections template:
         *
         * Sequence
         * GL
         * Type
         * Location
         * Transaction Date
         * Profitcenter
         * Remarks
         * Amount
         */

        const sequence = getExcelValue(row, "SEQUENCE");
        const type = getExcelValue(row, "TYPE");
        const gl = getExcelValue(row, "GL");
        const location = getExcelValue(row, "LOCATION");
        const transactionDate = getExcelValue(row, "TRANSACTION DATE");
        const normalizedTransactionDate = formatExcelDate(transactionDate);

        if (!normalizedTransactionDate) {
          errors.push({
            row: index + 2,
            error: "Invalid Transaction Date",
          });
          continue;
        }
        const profitcenter = getExcelValue(row, "PROFITCENTER");
        const remarks = getExcelValue(row, "REMARKS") ?? "";
        const amountValue = getExcelValue(row, "AMOUNT");
        const amount = Number(amountValue);

        /*
         * SEQUENCE
         */
        if (
          sequence === null ||
          sequence === undefined ||
          String(sequence).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Sequence is required",
          });
          continue;
        }

        /*
         * TYPE
         *
         * Type is an identifier used only to determine
         * which Debit Advice the row belongs to.
         *
         * It is NOT saved to DebitAdviceGLItems.
         */
        if (type === null || type === undefined || String(type).trim() === "") {
          errors.push({
            row: index + 2,
            error: "Type is required",
          });
          continue;
        }

        const normalizedType = String(type).trim().toUpperCase();

        if (normalizedType !== "GL" && normalizedType !== "SUPPLIER") {
          errors.push({
            row: index + 2,
            error: "Type must be either GL or Supplier",
          });
          continue;
        }

        /*
         * GL
         */
        if (gl === null || gl === undefined || String(gl).trim() === "") {
          errors.push({
            row: index + 2,
            error: "GL is required",
          });
          continue;
        }

        /*
         * LOCATION
         *
         * The frontend converts the Location name
         * into the corresponding Location master-data ID
         * before uploading the Excel file.
         *
         * Example:
         * BACOLOD -> 5
         */
        if (
          location === null ||
          location === undefined ||
          String(location).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Location is required",
          });
          continue;
        }

        const locationId = Number(location);

        if (isNaN(locationId) || locationId <= 0) {
          errors.push({
            row: index + 2,
            error: `Invalid Location "${location}"`,
          });
          continue;
        }

        /*
         * TRANSACTION DATE
         */
        if (
          transactionDate === null ||
          transactionDate === undefined ||
          String(transactionDate).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Transaction Date is required",
          });
          continue;
        }

        /*
         * PROFITCENTER
         *
         * Profitcenter is required only for GL type.
         *
         * TYPE = GL
         *   → Profitcenter is required
         *
         * TYPE = SUPPLIER
         *   → Profitcenter is optional / not required
         */
        if (
          normalizedType === "GL" &&
          (profitcenter === null ||
            profitcenter === undefined ||
            String(profitcenter).trim() === "")
        ) {
          errors.push({
            row: index + 2,
            error: "Profitcenter is required for GL type",
          });
          continue;
        }
        /*
         * AMOUNT
         */
        if (
          amountValue === null ||
          amountValue === undefined ||
          String(amountValue).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Amount is required",
          });
          continue;
        }

        if (isNaN(amount)) {
          errors.push({
            row: index + 2,
            error: "Invalid Amount",
          });
          continue;
        }

        /*
         * SEQUENCE
         *
         * All rows with the same SEQUENCE belong
         * to the same Debit Advice document.
         *
         * TYPE does not determine the document.
         *
         * Example:
         *
         * 1 + GL
         * 1 + Supplier
         *       ↓
         * Same Debit Advice
         */
        const documentKey = String(sequence).trim();

        /*
         * All rows with the same SEQUENCE belong
         * to ONE Debit Advice document.
         *
         * TYPE does NOT determine the document.
         */
        if (!groupedDocuments[documentKey]) {
          groupedDocuments[documentKey] = {
            id: 0,
            document_number: "0",
            transaction_date: normalizedTransactionDate,
            status_id: 4,
            quarter: 1,
            remarks: "",
            location_id: locationId,
            approval: 0,
            createdBy: { id: userId } as any,
            requestor_id: userId,

            line: [],
          };
        }

        /*
         * TYPE determines where the generic GL column is stored.
         *
         * TYPE = SUPPLIER
         *   → GL column becomes debit_advice_line.vendor_code
         *
         * TYPE = GL
         *   → GL column becomes debit_advice_gl_items.gl_code
         *
         * SEQUENCE still determines the Debit Advice document.
         */

        /*
         * Store rows temporarily under the same SEQUENCE.
         *
         * TYPE determines what the GL column represents:
         *
         * SUPPLIER
         *   GL column = Supplier/Vendor Code
         *
         * GL
         *   GL column = GL Code
         *
         * SEQUENCE is the connection between them.
         *
         * We do NOT connect based on Excel row order.
         */
        /*
         * Store Supplier and GL rows separately under the same SEQUENCE.
         *
         * SEQUENCE = connection between Supplier and GL.
         *
         * Supplier:
         *   GL column -> vendor_code
         *
         * GL:
         *   GL column -> gl_code
         *   Profitcenter -> profitcenter_code
         */
        const identifier = String(gl).trim();

        if (normalizedType === "SUPPLIER") {
          const supplierCode = identifier;

          const supplier = await this.supplierRepository.findOne({
            where: {
              supplier_code: supplierCode,
            },
          });

          if (!supplier) {
            errors.push({
              row: index + 2,
              error: `Supplier code "${supplierCode}" does not exist in master data`,
            });
            continue;
          }

          // Push directly to line array. Future GLs will be added to this supplier's glItems.
          groupedDocuments[documentKey].line.push({
            vendor_code: supplier.supplier_code,
            vendor_name: supplier.supplier_name || "-",
            category: "-",
            amount,
            particulars: remarks,
            glItems: [],
          });
        }

        if (normalizedType === "GL") {
          const glCode = identifier;

          const glAccount = await this.glAccountRepository.findOne({
            where: {
              gl_code: glCode,
            },
          });

          if (!glAccount) {
            errors.push({
              row: index + 2,
              error: `GL code "${glCode}" does not exist in master data`,
            });
            continue;
          }

          const currentLines = groupedDocuments[documentKey].line;
          if (currentLines.length === 0) {
            errors.push({
              row: index + 2,
              error: `GL row found before any Supplier row for SEQUENCE ${documentKey}. Please place the Supplier row immediately before its GL rows.`,
            });
            continue;
          }

          // Add this GL to the most recently read Supplier line in this sequence
          currentLines[currentLines.length - 1].glItems.push({
            gl_code: glAccount.gl_code,
            gl_name: glAccount.gl_name || "-",
            profitcenter_code: String(profitcenter ?? "").trim(),
            amount,
            Remarks: remarks,
          });
        }
      } catch (err) {
        errors.push({
          row: index + 2,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    /*
     * VALIDATE DEBIT ADVICE LINES
     *
     * Ensure each sequence has at least one valid Supplier line populated.
     */
    for (const documentKey of Object.keys(groupedDocuments)) {
      const document = groupedDocuments[documentKey];

      if (!document.line || document.line.length === 0) {
        errors.push({
          row: 0,
          error: `No Supplier row found for SEQUENCE ${documentKey}`,
        });

        delete groupedDocuments[documentKey];
      }
    }
    /*
     * SAVE DOCUMENTS
     *
     * Process Debit Advice documents in batches of 1,000.
     * Each SEQUENCE remains one complete Debit Advice + JV.
     */
    // ============================================
    // STOP ENTIRE UPLOAD IF ANY VALIDATION ERROR
    // EXISTS
    // ============================================
    if (errors.length > 0) {
      return {
        inserted_count: 0,
        updated_count: 0,
        inserted_row_numbers: [],
        updated_row_numbers: [],
        errors,
        success: [],
        created_documents: [],
      };
    }
    const documentKeys = Object.keys(groupedDocuments);
    const BATCH_SIZE = 1000;

    for (
      let batchStart = 0;
      batchStart < documentKeys.length;
      batchStart += BATCH_SIZE
    ) {
      const documentBatch = documentKeys.slice(
        batchStart,
        batchStart + BATCH_SIZE,
      );

      const currentBatchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;

      const totalBatchCount = Math.ceil(documentKeys.length / BATCH_SIZE);

      logger.warn(
        `Processing Sales Upload batch ${currentBatchNumber}/${totalBatchCount} ` +
          `(${documentBatch.length} documents)`,
      );

      const CONCURRENCY = 20;

      for (
        let startIndex = 0;
        startIndex < documentBatch.length;
        startIndex += CONCURRENCY
      ) {
        const concurrentDocuments = documentBatch.slice(
          startIndex,
          startIndex + CONCURRENCY,
        );

        await Promise.all(
          concurrentDocuments.map(async (documentKey) => {
            const document = groupedDocuments[documentKey];

            try {
              const createdDebitAdvice = await this.create(
                document,
                userId,
                accessKeyId,
                document.document_number,
              );

              inserted_count++;

              /*
               * Ensure Sales & Collections GL rows are persisted.
               *
               * Supplier data is stored in debit_advice_line.
               * GL data is stored in debit_advice_gl_items.
               *
               * SEQUENCE has already connected the Supplier + GL rows
               * into the same Debit Advice before this point.
               */

              /*
               * Reload relations after save.
               */
              const reloadedDebitAdvice =
                await this.debitAdviceRepository.findOne({
                  where: {
                    id: createdDebitAdvice.id,
                  },
                  relations: ["status", "createdBy", "lines", "lines.glItems"],
                });

              if (!reloadedDebitAdvice) {
                throw new NotFoundException(
                  `Debit Advice ${createdDebitAdvice.id} not found`,
                );
              }

              /*
               * Explicitly persist Excel Remarks to debit_advice_gl_items.
               *
               * Match the uploaded GL item to the saved GL item using
               * GL code + Profitcenter + Amount instead of array position.
               */
              for (const sourceLine of document.line ?? []) {
                const savedLine = reloadedDebitAdvice.lines?.find(
                  (line: any) =>
                    String(line.vendor_code).trim() ===
                    String(sourceLine.vendor_code).trim(),
                );

                if (!savedLine) {
                  continue;
                }

                for (const sourceGL of sourceLine.glItems ?? []) {
                  const savedGL = (savedLine.glItems ?? []).find(
                    (gl: any) =>
                      String(gl.gl_code).trim() ===
                        String(sourceGL.gl_code).trim() &&
                      String(gl.profitcenter_code).trim() ===
                        String(sourceGL.profitcenter_code).trim() &&
                      Number(gl.amount) === Number(sourceGL.amount),
                  );

                  if (!savedGL) {
                    continue;
                  }

                  savedGL.Remarks = String(sourceGL.Remarks ?? "").trim();

                  await this.debitAdviceGLItemsRepository.save(savedGL);
                }
              }

              created_documents.push(reloadedDebitAdvice);
              
              // ============================================
              // FINAL SUCCESS
              // ============================================
              success.push({
                __rowNum__: inserted_count,
                SEQUENCE: documentKey,
                DESTRIPTION: `Successfully inserted document with SEQUENCE ${documentKey}`,
                "TRANSACTION DATE": createdDebitAdvice.Transaction_date,
                AMOUNT: document.line?.[0]?.amount ?? 0,
                REASON: document.line?.[0]?.particulars ?? "",
                ID: createdDebitAdvice.id,
                DOCUMENT_NUMBER: createdDebitAdvice.document_number,
                STATUS_NAME: createdDebitAdvice.status_name,
                STATUS: "Inserted",
                id: createdDebitAdvice.id,
              });
            } catch (err) {
              errors.push({
                row: 0,
                error: `Failed saving ${documentKey}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              });
            }
          }),
        );
      }
    }

    /*
     * SSE Events
     */
    if (inserted_count > 0 || updated_count > 0) {
      try {
        this.sseEventEmitter.emitCreateSignal("debit-advices", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }

    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
      created_documents,
    };
  }

  async uploadExcelDebitAdvices_aprvl(
    filePath: string,
    userId: number,
    roleId?: number,
    accessKeyId?: number,
  ) {
    const XLSX = require("xlsx");

    const workbook = XLSX.read(fs.readFileSync(filePath), {
      type: "buffer",
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
      defval: null,
    });
    const getExcelValue = (row: any, columnName: string) => {
      const actualKey = Object.keys(row).find(
        (key) => key.trim().toUpperCase() === columnName.trim().toUpperCase(),
      );

      return actualKey ? row[actualKey] : null;
    };
    const inserted_row_numbers: number[] = [];
    const created_documents: any[] = [];
    const updated_row_numbers: number[] = [];
    const errors: { row: number; error: string }[] = [];
    const success: any[] = [];

    let inserted_count = 0;
    let updated_count = 0;

    const groupedDocuments: Record<string, any> = {};

    // Same filter the frontend applies: active matrix lines belonging to this user.
    const approvalMatrices = await this.approvalMatrixService.findAll();

    const userApprovalLines = approvalMatrices.flatMap(
      (matrix: any) =>
        matrix.lines?.filter(
          (line: any) => Number(line.userid) === userId && line.status_id === 1,
        ) ?? [],
    );

    // The line id used as the `approval` value on each document (0 = none).
    const defaultApprovalId = userApprovalLines[0]?.id ?? 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      try {
        /*
         * New Sales & Collections template:
         *
         * Sequence
         * GL
         * Type
         * Location
         * Transaction Date
         * Profitcenter
         * Remarks
         * Amount
         */

        const sequence = getExcelValue(row, "SEQUENCE");
        const type = getExcelValue(row, "TYPE");
        const gl = getExcelValue(row, "GL");
        const location = getExcelValue(row, "LOCATION");
        const transactionDate = getExcelValue(row, "TRANSACTION DATE");
        const normalizedTransactionDate = formatExcelDate(transactionDate);

        if (!normalizedTransactionDate) {
          errors.push({
            row: index + 2,
            error: "Invalid Transaction Date",
          });
          continue;
        }
        const profitcenter = getExcelValue(row, "PROFITCENTER");
        const remarks = getExcelValue(row, "REMARKS") ?? "";
        const amountValue = getExcelValue(row, "AMOUNT");
        const amount = Number(amountValue);

        /*
         * SEQUENCE
         */
        if (
          sequence === null ||
          sequence === undefined ||
          String(sequence).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Sequence is required",
          });
          continue;
        }

        /*
         * TYPE
         *
         * Type is an identifier used only to determine
         * which Debit Advice the row belongs to.
         *
         * It is NOT saved to DebitAdviceGLItems.
         */
        if (type === null || type === undefined || String(type).trim() === "") {
          errors.push({
            row: index + 2,
            error: "Type is required",
          });
          continue;
        }

        const normalizedType = String(type).trim().toUpperCase();

        if (normalizedType !== "GL" && normalizedType !== "SUPPLIER") {
          errors.push({
            row: index + 2,
            error: "Type must be either GL or Supplier",
          });
          continue;
        }

        /*
         * GL
         */
        if (gl === null || gl === undefined || String(gl).trim() === "") {
          errors.push({
            row: index + 2,
            error: "GL is required",
          });
          continue;
        }

        /*
         * LOCATION
         *
         * The frontend converts the Location name
         * into the corresponding Location master-data ID
         * before uploading the Excel file.
         *
         * Example:
         * BACOLOD -> 5
         */
        if (
          location === null ||
          location === undefined ||
          String(location).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Location is required",
          });
          continue;
        }

        const locationId = Number(location);

        if (isNaN(locationId) || locationId <= 0) {
          errors.push({
            row: index + 2,
            error: `Invalid Location "${location}"`,
          });
          continue;
        }

        /*
         * TRANSACTION DATE
         */
        if (
          transactionDate === null ||
          transactionDate === undefined ||
          String(transactionDate).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Transaction Date is required",
          });
          continue;
        }

        /*
         * PROFITCENTER
         *
         * Profitcenter is required only for GL type.
         *
         * TYPE = GL
         *   → Profitcenter is required
         *
         * TYPE = SUPPLIER
         *   → Profitcenter is optional / not required
         */
        if (
          normalizedType === "GL" &&
          (profitcenter === null ||
            profitcenter === undefined ||
            String(profitcenter).trim() === "")
        ) {
          errors.push({
            row: index + 2,
            error: "Profitcenter is required for GL type",
          });
          continue;
        }
        /*
         * AMOUNT
         */
        if (
          amountValue === null ||
          amountValue === undefined ||
          String(amountValue).trim() === ""
        ) {
          errors.push({
            row: index + 2,
            error: "Amount is required",
          });
          continue;
        }

        if (isNaN(amount)) {
          errors.push({
            row: index + 2,
            error: "Invalid Amount",
          });
          continue;
        }

        /*
         * SEQUENCE
         *
         * All rows with the same SEQUENCE belong
         * to the same Debit Advice document.
         *
         * TYPE does not determine the document.
         *
         * Example:
         *
         * 1 + GL
         * 1 + Supplier
         *       ↓
         * Same Debit Advice
         */
        const documentKey = String(sequence).trim();

        /*
         * All rows with the same SEQUENCE belong
         * to ONE Debit Advice document.
         *
         * TYPE does NOT determine the document.
         */
        if (!groupedDocuments[documentKey]) {
          groupedDocuments[documentKey] = {
            id: 0,
            document_number: "0",
            transaction_date: normalizedTransactionDate,
            status_id: 3,
            quarter: 1,
            remarks: "",
            location_id: locationId,
            approval: defaultApprovalId,
            createdBy: { id: userId } as any,
            requestor_id: userId,

            line: [],
          };
        }

        /*
         * TYPE determines where the generic GL column is stored.
         *
         * TYPE = SUPPLIER
         *   → GL column becomes debit_advice_line.vendor_code
         *
         * TYPE = GL
         *   → GL column becomes debit_advice_gl_items.gl_code
         *
         * SEQUENCE still determines the Debit Advice document.
         */

        /*
         * Store rows temporarily under the same SEQUENCE.
         *
         * TYPE determines what the GL column represents:
         *
         * SUPPLIER
         *   GL column = Supplier/Vendor Code
         *
         * GL
         *   GL column = GL Code
         *
         * SEQUENCE is the connection between them.
         *
         * We do NOT connect based on Excel row order.
         */
        /*
         * Store Supplier and GL rows separately under the same SEQUENCE.
         *
         * SEQUENCE = connection between Supplier and GL.
         *
         * Supplier:
         *   GL column -> vendor_code
         *
         * GL:
         *   GL column -> gl_code
         *   Profitcenter -> profitcenter_code
         */
        const identifier = String(gl).trim();

        if (normalizedType === "SUPPLIER") {
          const supplierCode = identifier;

          const supplier = await this.supplierRepository.findOne({
            where: {
              supplier_code: supplierCode,
            },
          });

          if (!supplier) {
            errors.push({
              row: index + 2,
              error: `Supplier code "${supplierCode}" does not exist in master data`,
            });
            continue;
          }

          // Push directly to line array. Future GLs will be added to this supplier's glItems.
          groupedDocuments[documentKey].line.push({
            vendor_code: supplier.supplier_code,
            vendor_name: supplier.supplier_name || "-",
            category: "-",
            amount,
            particulars: remarks,
            glItems: [],
          });
        }

        if (normalizedType === "GL") {
          const glCode = identifier;

          const glAccount = await this.glAccountRepository.findOne({
            where: {
              gl_code: glCode,
            },
          });

          if (!glAccount) {
            errors.push({
              row: index + 2,
              error: `GL code "${glCode}" does not exist in master data`,
            });
            continue;
          }

          const currentLines = groupedDocuments[documentKey].line;
          if (currentLines.length === 0) {
            errors.push({
              row: index + 2,
              error: `GL row found before any Supplier row for SEQUENCE ${documentKey}. Please place the Supplier row immediately before its GL rows.`,
            });
            continue;
          }

          // Add this GL to the most recently read Supplier line in this sequence
          currentLines[currentLines.length - 1].glItems.push({
            gl_code: glAccount.gl_code,
            gl_name: glAccount.gl_name || "-",
            profitcenter_code: String(profitcenter ?? "").trim(),
            amount,
            Remarks: remarks || "-",
          });
        }
      } catch (err) {
        errors.push({
          row: index + 2,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    /*
     * VALIDATE DEBIT ADVICE LINES
     *
     * Ensure each sequence has at least one valid Supplier line populated.
     */
    for (const documentKey of Object.keys(groupedDocuments)) {
      const document = groupedDocuments[documentKey];

      if (!document.line || document.line.length === 0) {
        errors.push({
          row: 0,
          error: `No Supplier row found for SEQUENCE ${documentKey}`,
        });

        delete groupedDocuments[documentKey];
      }
    }
    /*
     * SAVE DOCUMENTS
     *
     * Process Debit Advice documents in batches of 1,000.
     * Each SEQUENCE remains one complete Debit Advice + JV.
     */
    // ============================================
    // STOP ENTIRE UPLOAD IF ANY VALIDATION ERROR
    // EXISTS
    // ============================================
    if (errors.length > 0) {
      return {
        inserted_count: 0,
        updated_count: 0,
        inserted_row_numbers: [],
        updated_row_numbers: [],
        errors,
        success: [],
        created_documents: [],
      };
    }
    const documentKeys = Object.keys(groupedDocuments);
    const BATCH_SIZE = 1000;

    for (
      let batchStart = 0;
      batchStart < documentKeys.length;
      batchStart += BATCH_SIZE
    ) {
      const documentBatch = documentKeys.slice(
        batchStart,
        batchStart + BATCH_SIZE,
      );

      const currentBatchNumber = Math.floor(batchStart / BATCH_SIZE) + 1;

      const totalBatchCount = Math.ceil(documentKeys.length / BATCH_SIZE);

      logger.warn(
        `Processing Sales Upload batch ${currentBatchNumber}/${totalBatchCount} ` +
          `(${documentBatch.length} documents)`,
      );

      const CONCURRENCY = 20;

      for (
        let startIndex = 0;
        startIndex < documentBatch.length;
        startIndex += CONCURRENCY
      ) {
        const concurrentDocuments = documentBatch.slice(
          startIndex,
          startIndex + CONCURRENCY,
        );

        await Promise.all(
          concurrentDocuments.map(async (documentKey) => {
            const document = groupedDocuments[documentKey];

            try {
              const createdDebitAdvice = await this.create(
                document,
                userId,
                accessKeyId,
                document.document_number,
              );

              /*
               * Ensure Sales & Collections GL rows are persisted.
               *
               * Supplier data is stored in debit_advice_line.
               * GL data is stored in debit_advice_gl_items.
               *
               * SEQUENCE has already connected the Supplier + GL rows
               * into the same Debit Advice before this point.
               */

              /*
               * Reload relations after save.
               */
              const reloadedDebitAdvice =
                await this.debitAdviceRepository.findOne({
                  where: {
                    id: createdDebitAdvice.id,
                  },
                  relations: ["status", "createdBy", "lines", "lines.glItems"],
                });

              if (!reloadedDebitAdvice) {
                throw new NotFoundException(
                  `Debit Advice ${createdDebitAdvice.id} not found`,
                );
              }

              /*
               * Explicitly persist Excel Remarks to debit_advice_gl_items.
               *
               * Match the uploaded GL item to the saved GL item using
               * GL code + Profitcenter + Amount instead of array position.
               */
              for (const sourceLine of document.line ?? []) {
                const savedLine = reloadedDebitAdvice.lines?.find(
                  (line: any) =>
                    String(line.vendor_code).trim() ===
                    String(sourceLine.vendor_code).trim(),
                );

                if (!savedLine) {
                  continue;
                }

                for (const sourceGL of sourceLine.glItems ?? []) {
                  const savedGL = (savedLine.glItems ?? []).find(
                    (gl: any) =>
                      String(gl.gl_code).trim() ===
                        String(sourceGL.gl_code).trim() &&
                      String(gl.profitcenter_code).trim() ===
                        String(sourceGL.profitcenter_code).trim() &&
                      Number(gl.amount) === Number(sourceGL.amount),
                  );

                  if (!savedGL) {
                    continue;
                  }

                  const remarksToSave = String(sourceGL.Remarks ?? "").trim();

                  savedGL.Remarks = remarksToSave;

                  const savedGLItem =
                    await this.debitAdviceGLItemsRepository.save(savedGL);

                  const verifyGLItem =
                    await this.debitAdviceGLItemsRepository.findOne({
                      where: {
                        id: savedGLItem.id,
                      },
                    });
                }
              }
              // ============================================
              // INITIALIZE APPROVAL STAGES
              // ============================================

              // Look up module by name
              const module = await this.moduleRepository.findOne({
                where: {
                  module_name: this.module_name,
                  status_id: 1,
                },
              });

              if (!module) {
                throw new NotFoundException(
                  `Module '${this.module_name}' not found`,
                );
              }

              await this.approvalLogsService.initialize(
                {
                  transaction_id: reloadedDebitAdvice.id,
                  module_id: module.id,
                  document_number: reloadedDebitAdvice.document_number,
                  transaction_date: reloadedDebitAdvice.transaction_date,
                  approval_id: defaultApprovalId,
                  requestor_id: reloadedDebitAdvice.requestor_id,
                },
                userId,
              );

              // Queue email only when status is Pending for Approval
              if (reloadedDebitAdvice.status_id === 3) {
                await this.emailQueueService.enqueue({
                  document_number: reloadedDebitAdvice.document_number,
                  transaction_id: reloadedDebitAdvice.id,
                  module_id: module.id,
                  trigger_status_id: 3,
                  created_by: userId,
                  email_subject: `[${this.module_name}] PENDING FOR APPROVAL`,
                });
              }

              created_documents.push(reloadedDebitAdvice);

              // ============================================
              // FINAL SUCCESS
              // ============================================

              inserted_count++;

              success.push({
                __rowNum__: inserted_count,
                SEQUENCE: documentKey,
                DESTRIPTION: `Successfully inserted document with SEQUENCE ${documentKey}`,
                "TRANSACTION DATE": createdDebitAdvice.Transaction_date,
                AMOUNT: document.line?.[0]?.amount ?? 0,
                REASON: document.line?.[0]?.particulars ?? "",
                ID: createdDebitAdvice.id,
                DOCUMENT_NUMBER: createdDebitAdvice.document_number,
                STATUS_NAME: createdDebitAdvice.status_name,
                STATUS: "Inserted",
                id: createdDebitAdvice.id,
              });
            } catch (err) {
              errors.push({
                row: 0,
                error: `Failed saving ${documentKey}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              });
            }
          }),
        );
      }
    }

    /*
     * SSE Events
     */
    if (inserted_count > 0 || updated_count > 0) {
      try {
        this.sseEventEmitter.emitCreateSignal("debit-advices", 0);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }
    }

    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
      created_documents,
    };
  }
  /**
   * Get allowed location IDs based on user and role
   * Reusable helper to avoid redundant code across multiple methods
   */
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

  async GetbysearchAndPages(
    page: number,
    pageSize: number,
    search: string,
    statusId: number | string,
    userId: number,
    roleId: number,
  ) {
    try {
      const query = this.debitAdviceRepository.createQueryBuilder("da");

      const allowedLocationIds = await this.getAllowedLocationIds(
        userId,
        roleId,
      );

      query
        .leftJoinAndSelect("da.status", "status")
        .leftJoinAndSelect("da.createdBy", "createdBy");

      // Prevent SQL error when no locations are assigned
      if (allowedLocationIds.length > 0) {
        query.where("da.location_id IN (:...allowedLocationIds)", {
          allowedLocationIds,
        });
      } else {
        query.where("1 = 0"); // Return no records
      }

      // Search
      if (search?.trim()) {
        query.andWhere(
          new Brackets((qb) => {
            qb.where("da.document_number LIKE :search")
              .orWhere("createdBy.first_name LIKE :search")
              .orWhere("createdBy.last_name LIKE :search");
          }),
          {
            search: `%${search.trim()}%`,
          },
        );
      }
      // FILTER BY STATUS
      if (statusId) {
        query.andWhere("da.status_id = :statusId", {
          statusId: Number(statusId),
        });
      }

      // PAGINATION
      query.skip((page - 1) * pageSize);
      query.take(pageSize);

      // SORT
      query.orderBy("da.id", "ASC");

      const [items, totalCount] = await query.getManyAndCount();

      return {
        items: items.map((item) => ({
          id: item.id,
          document_number: item.document_number,
          transaction_date: item.transaction_date,
          status_id: item.status_id,
          status_name: item.status ? item.status.status_name : null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          jv_no: item.jv_no,
          created_user: item.createdBy
            ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
            : null,
        })),

        totalCount,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error("Error fetching debit advices:", error);
      throw new Error("Failed to fetch debit advices");
    }
  }

  async saveAttachment(
    module: string,
    referenceId: number,
    documentNumber: string,
    file: Express.Multer.File,
    userId: number,
  ) {
    const attachment = this.attachmentRepository.create({
      module,
      reference_id: referenceId,
      document_number: documentNumber,
      file_name: file.filename,
      original_name: file.originalname,
      file_path: path
        .relative(path.join(process.cwd(), "uploads"), file.path)
        .replace(/\\/g, "/"),
      mime_type: file.mimetype,
      file_size: file.size,
      createdBy: { id: userId } as any,
      isdeleted: 0,
      deleted_by: 0,
    });

    // SSE Events
    try {
      this.sseEventEmitter.emitCreate("debit-advices", attachment.id);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return await this.attachmentRepository.save(attachment);
  }

  async findAttachment(docno: string) {
    const attachment = await this.attachmentRepository.find({
      where: { document_number: docno, isdeleted: 0 },
    });

    // if (!attachment || attachment.length === 0) {
    //     throw new NotFoundException(
    //         "Attachment not found",
    //     );
    // }

    return attachment;
  }

  async deleteAttachment(id: string, userId: number) {
    const attachment = await this.attachmentRepository.findOneBy({
      id: Number(id),
    });

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    const filePath = attachment.file_path;

    attachment.isdeleted = 1;
    attachment.deleted_by = userId;

    const result = await this.attachmentRepository.save(attachment);

    if (filePath) {
      try {
        const fullPath = path.join(process.cwd(), "uploads", filePath);

        await fs.promises.unlink(fullPath);
      } catch (error) {
        logger.error("Failed to delete physical file:", error);
      }
    }

    try {
      this.sseEventEmitter.emitCreate("debit-advices", Number(id));
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return result;
  }
}

const formatExcelDate = (excelDate: any) => {
  if (!excelDate) return null;

  // If already string/date
  if (typeof excelDate === "string") {
    return excelDate;
  }

  // Excel serial number
  if (typeof excelDate === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));

    const calculatedDate = new Date(
      excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000,
    );

    const year = calculatedDate.getUTCFullYear();
    const month = String(calculatedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(calculatedDate.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
};
