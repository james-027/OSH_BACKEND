import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Brackets } from "typeorm";
import { WeighIn_header } from "../../../entities/WeighInHeader";
import { WeighInLine } from "src/entities/WeighInItems";
import { CreateWeighInDto } from "../dto/CreateWeighInDto";
import { UpdateWeighInDto } from "../dto/UpdateWeighInDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import logger from "../../../config/logger";
import { CommonUtilitiesService } from "../../../services/common-utilities.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";
import { TransactionAttachment } from "src/entities/TransactionAttachment";
import { Module } from "src/entities/Module";
import * as fs from "fs";
import * as path from "path";
import { EmailQueueService } from "src/modules/email-queue/services/email-queue.service";

@Injectable()
export class WeighInService {
  constructor(
    private readonly emailQueueService: EmailQueueService,
    @InjectRepository(WeighIn_header)
    private weighInRepository: Repository<WeighIn_header>,
    @InjectRepository(WeighInLine)
    private weighInLineRepository: Repository<WeighInLine>,
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
  ) {}

  private readonly module_name = "DIGITAL CRANE SCALE";

  private mapWeighInResponse(item: WeighIn_header, includeLines = false, includeDriverLicenseImage = false) {
    return {
      id: item.id,
      control_no: item.control_no,
      po_number: item.po_number,
      transaction_date: item.transaction_date,
      session_status: item.session_status,
      grower: item.grower,
      farm_location: item.farm_location,
      sold_to: item.sold_to,
      address: item.address,
      buyer_rep: item.buyer_rep,
      buyer_signature: item.buyer_signature,
      driver_license: item.driver_license,
     ...(includeDriverLicenseImage && { driver_license_image: item.driver_license_image }),
      truck_plate: item.truck_plate,
      target_heads: item.target_heads,
      checked_by: item.checked_by,
      checked_signature: item.checked_signature,
      attested_by: item.attested_by,
      attested_signature: item.attested_signature,
      status_id: item.status_id,
      status_name: item.status ? item.status.status_name : null,
      created_at: item.created_at,
      updated_at: item.updated_at,
      created_user: item.createdBy
        ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
        : null,
      ...(includeLines && {
        lines_items: (item.lines || []).map((line) => ({
          ...line,
        })),
      }),
    };
  }

  // Get all weigh-in sessions filtered by user (or all if admin)
  async findAll(userId?: number, roleId?: number): Promise<any[]> {
    try {
      const query = this.weighInRepository.createQueryBuilder("wi")
        .leftJoinAndSelect("wi.status", "status")
        .leftJoinAndSelect("wi.createdBy", "createdBy")
        .leftJoinAndSelect("wi.lines", "lines");

      if (userId && roleId && roleId !== 1) {
        query.where("wi.created_by = :userId", { userId });
      }

      query.orderBy("wi.id", "ASC").addOrderBy("lines.id", "ASC");

      const weighIns = await query.getMany();
      return weighIns.map((item) => this.mapWeighInResponse(item, true));
    } catch (error) {
      logger.error("Error fetching weigh-ins:", error);
      throw new Error("Failed to fetch weigh-ins");
    }
  }

  // Get weigh-ins by search and pagination with user ownership restriction
 async GetbysearchAndPages(
  page: number,
  pageSize: number,
  search: string,
  statusId: number | string,
  userId: number,
  roleId: number,
) {
  try {
    const currentPage = Math.max(1, Number(page) || 1);
    const limit = Math.max(1, Number(pageSize) || 7);
    const offset = (currentPage - 1) * limit;

    // STEP 1: Query and paginate HEADER records only
    const headerQuery = this.weighInRepository
      .createQueryBuilder("wi")
      .leftJoin("wi.createdBy", "createdBy");

    // Admin can view all records
    if (Number(roleId) !== 1) {
      headerQuery.where("wi.created_by = :userId", { userId });
    }

    // Search filter
    if (search?.trim()) {
      headerQuery.andWhere(
        new Brackets((qb) => {
          qb.where("wi.control_no LIKE :search")
            .orWhere("wi.po_number LIKE :search")
            .orWhere("wi.truck_plate LIKE :search")
            .orWhere("wi.grower LIKE :search")
            .orWhere("createdBy.first_name LIKE :search")
            .orWhere("createdBy.last_name LIKE :search");
        }),
        {
          search: `%${search.trim()}%`,
        },
      );
    }

    // Status filter
    if (statusId) {
      headerQuery.andWhere("wi.status_id = :statusId", {
        statusId: Number(statusId),
      });
    }

    // Get distinct header records and total count
    const [headers, totalCount] = await headerQuery
      .select(["wi.id"])
      .orderBy("wi.id", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const headerIds = headers.map((header) => header.id);

    // STEP 2: Fetch complete headers with their relations
    let items: WeighIn_header[] = [];

    if (headerIds.length > 0) {
      items = await this.weighInRepository
        .createQueryBuilder("wi")
        .leftJoinAndSelect("wi.status", "status")
        .leftJoinAndSelect("wi.createdBy", "createdBy")
        .leftJoinAndSelect("wi.lines", "lines")
        .where("wi.id IN (:...headerIds)", { headerIds })
        .orderBy("wi.id", "DESC")
        .addOrderBy("lines.id", "ASC")
        .getMany();
    }

    // STEP 3: Return paginated response
    return {
      items: items.map((item) =>
        this.mapWeighInResponse(item, true),
      ),
      totalCount,
      page: currentPage,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    };

  } catch (error) {
    logger.error("Error fetching weigh-ins:", error);
    throw new Error("Failed to fetch weigh-ins");
  }
}

  async findOneHistory(ref_id: number) {
    return this.ActionLogsService.findPerModuleRefID(this.module_name, ref_id);
  }

  async findOne(id: number): Promise<any> {
    try {
      const weighIn = await this.weighInRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "lines"],
      });
      if (!weighIn) {
        throw new NotFoundException(`Weigh-in with ID ${id} not found`);
      }
      // Set to true so PC/Web client receives the driver license image
      return this.mapWeighInResponse(weighIn, true, true);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error fetching weigh-in:", error);
      throw new Error("Failed to fetch weigh-in");
    }
  }

  async findBulk(ids: number[]): Promise<any[]> {
    try {
      const weighIns = await this.weighInRepository.find({
        where: {
          id: In(ids),
        },
        relations: ["status", "createdBy", "lines"],
        order: {
          id: "ASC",
          lines: {
            id: "ASC",
          },
        },
      });

      return weighIns.map((weighIn) => this.mapWeighInResponse(weighIn, true));
    } catch (error) {
      logger.error("Error fetching weigh-ins in bulk:", error);
      throw new Error("Failed to fetch weigh-ins in bulk");
    }
  }

  async create(
    createWeighInDto: CreateWeighInDto,
    userId: number,
    accessKeyId: number,
    poNumber?: string,
    roleId?: number,
  ): Promise<any> {
    let savedWeighIn: any;
    try {
      let trans_number = createWeighInDto.po_number || "";

      if (trans_number) {
        const existingWeighIn = await this.weighInRepository.findOne({
          where: { po_number: trans_number },
        });
        if (existingWeighIn) {
          throw new BadRequestException("Weigh-in PO number already exists");
        }
      } else {
        trans_number = await this.commonUtilitiesService.generateTransactionNumber({
          transaction_type: "DIGITAL CRANE SCALE",
          location_id: 1,
          vendor_id: 0,
          access_key_id: accessKeyId,
          format: "W{abbr}{key}{year}-{seq:5}",
          reset_per_year: true,
          currentDate: createWeighInDto.transaction_date
            ? new Date(createWeighInDto.transaction_date)
            : new Date(),
          abbr: null,
        });
      }

      const newWeighIn = this.weighInRepository.create({
        createdBy: { id: userId } as any,
        control_no: createWeighInDto.control_no,
        po_number: trans_number,
        transaction_date: createWeighInDto.transaction_date
          ? new Date(createWeighInDto.transaction_date)
          : new Date(),
        session_status: createWeighInDto.session_status ?? "ACTIVE",
        grower: createWeighInDto.grower,
        farm_location: createWeighInDto.farm_location,
        sold_to: createWeighInDto.sold_to,
        address: createWeighInDto.address,
        buyer_rep: createWeighInDto.buyer_rep,
        buyer_signature: createWeighInDto.buyer_signature,
        driver_license: createWeighInDto.driver_license,
        driver_license_image: createWeighInDto.driver_license_image,
        truck_plate: createWeighInDto.truck_plate,
        target_heads: createWeighInDto.target_heads,
        checked_by: createWeighInDto.checked_by,
        checked_signature: createWeighInDto.checked_signature,
        attested_by: createWeighInDto.attested_by,
        attested_signature: createWeighInDto.attested_signature,
        tally_sheet_pdf: createWeighInDto.tally_sheet_pdf,
        status_id: createWeighInDto.status_id ?? 1,
        lines: (createWeighInDto.line || []).map((item) => ({
          ...item,
          weigh_timestamp: item.weigh_timestamp
            ? new Date(item.weigh_timestamp)
            : new Date(),
          createdBy: { id: userId } as any,
        })),
      });

      savedWeighIn = await this.weighInRepository.save(newWeighIn);

      try {
        this.sseEventEmitter.emitCreate("weigh-ins", savedWeighIn.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      const reloadedWeighIn = await this.weighInRepository.findOne({
        where: { id: savedWeighIn.id },
        relations: ["status", "createdBy", "lines"],
      });

      await this.ActionLogsService.logAction({
        action_id: 1,
        ref_id: reloadedWeighIn.id,
        module_name: this.module_name,
        description: `Created weigh-in with SI number ${reloadedWeighIn.po_number}`,
        raw_data: JSON.stringify(reloadedWeighIn),
        created_by: userId,
      });

      await this.userAuditTrailCreateService.create(
        {
          service: "WEIGH_INS",
          method: "create",
          raw_data: JSON.stringify(reloadedWeighIn),
          description: `Created weigh-in: ${reloadedWeighIn.po_number}`,
          status_id: reloadedWeighIn.status_id,
        },
        userId,
      );

      const module = await this.moduleRepository.findOne({
        where: {
          module_name: this.module_name,
          status_id: 1,
        },
      });

      if (!module) {
        throw new NotFoundException(`Module '${this.module_name}' not found`);
      }

      await this.emailQueueService.enqueue({
        document_number: reloadedWeighIn.po_number,
        transaction_id: reloadedWeighIn.id,
        module_name: this.module_name,
        trigger_status_id: 4,
        created_by: userId,
        email_subject: `[${this.module_name}] POSTED`,
      });

      return this.mapWeighInResponse(reloadedWeighIn, true);
    } catch (error) {
      if (savedWeighIn && savedWeighIn.id) {
        await this.rollbackTransaction(savedWeighIn);
      }
      logger.error("Error creating weigh-in:", error);
      throw error;
    }
  }

  async update(
    poNumber: string,
    updateWeighInDto: UpdateWeighInDto,
    userId: number,
    accessKeyId: number,
  ): Promise<any> {
    let updatedWeighIn: any;
    try {
      const weighIn = await this.weighInRepository.findOne({
        where: { po_number: poNumber },
      });
      if (!weighIn) {
        throw new NotFoundException(
          `Weigh-in with PO number ${poNumber} not found`,
        );
      }

      const { line, ...headerFields } = updateWeighInDto;
      Object.assign(weighIn, headerFields, { updated_by: userId });
      updatedWeighIn = await this.weighInRepository.save(weighIn);

      if (line && line.length > 0) {
        for (const lineItemDto of line) {
          if (lineItemDto.id) {
            const existingLine = await this.weighInLineRepository.findOne({
              where: { id: lineItemDto.id },
            });
            if (existingLine) {
              if (lineItemDto.isdeleted === 1) {
                await this.weighInLineRepository.delete(existingLine.id);
                continue;
              } else {
                Object.assign(existingLine, lineItemDto, {
                  weigh_timestamp: lineItemDto.weigh_timestamp
                    ? new Date(lineItemDto.weigh_timestamp)
                    : existingLine.weigh_timestamp,
                  updated_by: userId,
                });
                await this.weighInLineRepository.save(existingLine);
              }
            }
          } else {
            const newLine = this.weighInLineRepository.create({
              ...lineItemDto,
              weigh_timestamp: lineItemDto.weigh_timestamp
                ? new Date(lineItemDto.weigh_timestamp)
                : new Date(),
              header: weighIn,
              createdBy: { id: userId } as any,
            });
            await this.weighInLineRepository.save(newLine);
          }
        }
      }

      try {
        this.sseEventEmitter.emitUpdate("weigh-ins", updatedWeighIn.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      const reloadedWeighIn = await this.weighInRepository.findOne({
        where: { id: updatedWeighIn.id },
        relations: ["status", "createdBy", "lines"],
      });

      await this.ActionLogsService.logAction({
        action_id: 2,
        ref_id: reloadedWeighIn.id,
        module_name: this.module_name,
        description: `Updated Weigh-In Document ${reloadedWeighIn.po_number}`,
        raw_data: JSON.stringify(reloadedWeighIn),
        created_by: userId,
      });

      await this.userAuditTrailCreateService.create(
        {
          service: "WEIGH_INS",
          method: reloadedWeighIn.status?.status_name || "UPDATE",
          raw_data: JSON.stringify(reloadedWeighIn),
          description: `Updated weigh-in: ${reloadedWeighIn.po_number}`,
          status_id: reloadedWeighIn.status_id,
        },
        userId,
      );

      return this.mapWeighInResponse(reloadedWeighIn, true);
    } catch (error) {
      logger.error("Error updating weigh-in:", error);
      throw error;
    }
  }

  async delete(poNumber: string, userId: number): Promise<any> {
    try {
      const weighIn = await this.weighInRepository.findOne({
        where: { po_number: poNumber },
      });
      if (!weighIn) {
        throw new NotFoundException(
          `Weigh-in with PO number ${poNumber} not found`,
        );
      }

      await this.weighInLineRepository.delete({ header_id: weighIn.id });
      await this.weighInRepository.delete({ id: weighIn.id });

      await this.userAuditTrailCreateService.create(
        {
          service: "WEIGH_INS",
          method: "DELETE",
          raw_data: JSON.stringify(weighIn),
          description: `Deleted weigh-in: ${weighIn.po_number}`,
          status_id: 14,
        },
        userId,
      );
      return { success: true, message: "Weigh-in deleted successfully" };
    } catch (error) {
      logger.error("Error deleting weigh-in:", error);
      throw error;
    }
  }

  private async rollbackTransaction(header: any) {
    try {
      await this.weighInLineRepository.delete({ header_id: header.id });
      await this.weighInRepository.delete(header.id);
      return { success: true, message: "Rollback successful" };
    } catch (rollbackError) {
      logger.error("Rollback failed:", rollbackError);
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

    try {
      this.sseEventEmitter.emitCreate("weigh-ins", attachment.id);
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return await this.attachmentRepository.save(attachment);
  }

  async findAttachment(poNumber: string) {
    return await this.attachmentRepository.find({
      where: { document_number: poNumber, isdeleted: 0 },
    });
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
      this.sseEventEmitter.emitCreate("weigh-ins", Number(id));
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return result;
  }
}