import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Transaction } from "typeorm";
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
import { Inject } from "@nestjs/common";
import { stat } from "fs";
import { Brackets } from "typeorm";

// This is for the main service file for debit advice. It will contain the business logic for handling debit advice operations such as
// create, read, update, and delete. The service will interact with the database through the repository and also handle any necessary
// transformations or validations before returning the response to the controller. Additionally, it will log audit trails for create
// and update operations to keep track of changes made to the debit advice records.

@Injectable()
export class DebitAdviceService {
  constructor(
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
  ) {}
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

  async findOneHistory(ref_id: number) {
    const module_id = 34; // DEBIT ADVICES
    return this.ActionLogsService.findPerModuleRefID(module_id, ref_id);
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
  // Create new debit advice
  async create(
    createDebitAdviceDto: CreateDebitAdviceDto,
    userId: number,
    accessKeyId: number,
    docno: string,
  ): Promise<any> {
    let savedDebitAdvice: any;
    try {
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
        status_id: createDebitAdviceDto.status_id ?? 13,
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
        console.log("working");
        this.sseEventEmitter.emitCreate("debit-advices", savedDebitAdvice.id);
      } catch (err) {
        console.log("not working create");
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
        module_id: 34, // STORE HURDLES
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
        created_user: reloadedDebitAdvice.createdBy
          ? `${reloadedDebitAdvice.createdBy.first_name} ${reloadedDebitAdvice.createdBy.last_name}`
          : null,
        // ✅ include GL items inside each line
        lines_items: (reloadedDebitAdvice.lines || []).map((line) => ({
          ...line,
        })),
      };
    } catch (error) {
      await this.rollbackWarehouseTransaction(savedDebitAdvice);
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
                      ref_docno: debitAdvice.document_number,
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
        console.log("working");
        this.sseEventEmitter.emitUpdate("debit-advices", updatedDebitAdvice.id);
      } catch (err) {
        console.log("not working");
        logger.error("SSE event failed:", err);
      }

      const reloadedDebitAdvice = await this.debitAdviceRepository.findOne({
        where: { id: updatedDebitAdvice.id },
        relations: ["status", "createdBy", "lines"],
      });

      let action_id = 1;
      let description = ``;
      // console.log("Current status ID:", current_status_id);
      // console.log("New status ID:", reloadedDebitAdvice.status_id);
      if (reloadedDebitAdvice.status_id === current_status_id) {
        action_id = 2; // EDIT
        switch (reloadedDebitAdvice.status_id) {
          case 13:
            description = `Edit Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
            break;
        }
      } else if (
        reloadedDebitAdvice.status_id === 3 ||
        (reloadedDebitAdvice.status_id === 13 && current_status_id !== 7)
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
        reloadedDebitAdvice.status_id === 13 &&
        current_status_id === 7
      ) {
        action_id = 2;
        description = `Return to Maker Debit Advice Document ${reloadedDebitAdvice.document_number} and status ${reloadedDebitAdvice.status?.status_name || "Unknown"}`;
      }

      // Action log
      await this.ActionLogsService.logAction({
        action_id: action_id, // add
        ref_id: reloadedDebitAdvice.id,
        module_id: 34, // DEBIT ADVICES
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

      return {
        id: reloadedDebitAdvice.id,
        status_id: reloadedDebitAdvice.status_id,
        status_name: reloadedDebitAdvice.status?.status_name || null,
        created_at: reloadedDebitAdvice.created_at,
        updated_at: reloadedDebitAdvice.updated_at,
        document_number: reloadedDebitAdvice.document_number,
        transaction_date: reloadedDebitAdvice.transaction_date,
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
    const fs = require("fs");
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
          error: err.message,
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
      } catch (err) {
        errors.push({
          row: document.rowNum,
          error: `Failed saving sequence ${sequence}: ${err.message}`,
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

  async GetbysearchAndPages(
    page: number,
    pageSize: number,
    search: string,
    statusId: number | string,
  ) {
    try {
      const query = this.debitAdviceRepository.createQueryBuilder("da");

      query
        .leftJoinAndSelect("da.status", "status")
        .leftJoinAndSelect("da.createdBy", "createdBy");

      // SEARCH
      if (search) {
        query.andWhere(
          new Brackets((qb) => {
            // Search in document number, created by first name, or created by last name
            qb.where("da.document_number LIKE :search")
              .orWhere("createdBy.first_name LIKE :search")
              .orWhere("createdBy.last_name LIKE :search");
          }),
          { search: `%${search}%` },
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
}

const formatExcelDate = (excelDate: any) => {
  if (!excelDate) return null;

  // If already string/date
  if (typeof excelDate === "string") {
    return excelDate;
  }

  // Excel serial number
  const jsDate = new Date((excelDate - 25569) * 86400 * 1000);

  return jsDate.toISOString().split("T")[0];
};
