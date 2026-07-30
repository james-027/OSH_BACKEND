import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Brackets } from "typeorm";

import { EmailNotificationMatrix } from "../../../entities/EmailNotificationMatrix";
import { EmailNotificationMatrixDetails } from "../../../entities/EmailNotificationMatrixDetails";
import { EmailNotificationMatrixRecipients } from "../../../entities/EmailNotificationMatrixRecipients";

import { CreateEmailNotificationMatrixDto } from "../dto/CreateEmailNotificationMatrixDto";
import { UpdateEmailNotificationMatrixDto } from "../dto/UpdateEmailNotificationMatrixDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";

import logger from "../../../config/logger";

@Injectable()
export class EmailNotificationMatrixService {
  constructor(
    @InjectRepository(EmailNotificationMatrix)
    private emailNotificationMatrixRepository: Repository<EmailNotificationMatrix>,

    @InjectRepository(EmailNotificationMatrixDetails)
    private emailNotificationMatrixDetailsRepository: Repository<EmailNotificationMatrixDetails>,

    @InjectRepository(EmailNotificationMatrixRecipients)
    private emailNotificationMatrixRecipientsRepository: Repository<EmailNotificationMatrixRecipients>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,

    @Inject(ActionLogsService)
    private actionLogsService: ActionLogsService,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      return await this.emailNotificationMatrixRepository.find({
        relations: [
          "status",
          "createdBy",
          "moduleData",
          "lines",
          "lines.recipients",
        ],
        order: {
          id: "ASC",
        },
      });
    } catch (error) {
      logger.error("Error fetching email notification matrix", error);
      throw error;
    }
  }

  async findOne(id: number): Promise<any> {
    const data = await this.emailNotificationMatrixRepository.findOne({
      where: { id },
      relations: [
        "status",
        "createdBy",
        "moduleData",
        "lines",
        "lines.status",
        "lines.triggerStatus",
        "lines.moduleData",
        "lines.recipients",
        "lines.recipients.userMaker",
      ],
    });

    if (!data) {
      throw new NotFoundException(`Email Notification Matrix ${id} not found`);
    }

    return data;
  }

  async findOneHistory(ref_id: number) {
    const module_name = "EMAIL NOTIFICATION MATRIX";
    return this.actionLogsService.findPerModuleRefID(module_name, ref_id);
  }

  async create(
    dto: CreateEmailNotificationMatrixDto,
    userId: number,
    accessKeyId: number,
  ) {
    let savedHeader: any;

    try {
      const existing = await this.emailNotificationMatrixRepository.findOne({
        where: {
          module: dto.module,
        },
        relations: ["moduleData"],
      });

      if (existing) {
        throw new BadRequestException(
          `Email Notification Matrix already exists for ${
            existing.moduleData
              ? existing.moduleData.module_name
              : existing.module
          }`,
        );
      }

      const header = this.emailNotificationMatrixRepository.create({
        module: dto.module,
        smtp_email: dto.smtp_email ?? null,
        smtp_server: dto.smtp_server ?? null,
        smtp_port: dto.smtp_port ?? null,
        smtp_security: dto.smtp_security ?? null,
        smtp_auth_method: dto.smtp_auth_method ?? null,
        smtp_username: dto.smtp_username ?? null,
        smtp_password: dto.smtp_password ?? null,
        status_id: dto.status_id ?? 1,
        createdBy: { id: userId } as any,
      });

      savedHeader = await this.emailNotificationMatrixRepository.save(header);

      for (const detailDto of dto.lines) {
        // Prevent duplicate recipients (userid) within the same email title row
        const recipientIds = detailDto.recipients.map((x) => x.userid);

        if (new Set(recipientIds).size !== recipientIds.length) {
          throw new BadRequestException(
            `Duplicate recipient found for "${detailDto.email_title}"`,
          );
        }

        const existingTitle =
          await this.emailNotificationMatrixDetailsRepository.findOne({
            where: {
              header_id: savedHeader.id,
              email_title: detailDto.email_title,
            },
          });

        if (existingTitle && existingTitle.status_id !== 14) {
          throw new BadRequestException(
            `Email Title "${detailDto.email_title}" already exists for this matrix.`,
          );
        }

        const detail = await this.emailNotificationMatrixDetailsRepository.save(
          this.emailNotificationMatrixDetailsRepository.create({
            header: savedHeader,
            email_title: detailDto.email_title,
            module: detailDto.module ? Number(detailDto.module) : dto.module,
            trigger_status_id: detailDto.trigger_status_id
              ? Number(detailDto.trigger_status_id)
              : null,
            email_format: detailDto.email_format ?? null,
            status_id: detailDto.status_id ?? 1,
            createdBy: { id: userId } as any,
          }),
        );

        for (const recipientDto of detailDto.recipients) {
          await this.emailNotificationMatrixRecipientsRepository.save(
            this.emailNotificationMatrixRecipientsRepository.create({
              line_id: detail.id,
              userid: Number(recipientDto.userid),
              email: recipientDto.email ?? null,
              is_approval_matrix: recipientDto.is_approval_matrix ? 1 : 0,
              module: recipientDto.module
                ? Number(recipientDto.module)
                : dto.module,
              status_id: recipientDto.status_id ?? 1,
              createdBy: { id: userId } as any,
            }),
          );
        }
      }

      try {
        this.sseEventEmitter.emitCreate(
          "email-notification-matrix",
          savedHeader.id,
        );
      } catch (err) {
        logger.error("SSE failed", err);
      }

      const result = await this.findOne(savedHeader.id);

      await this.userAuditTrailCreateService.create(
        {
          service: "EMAIL_NOTIFICATION_MATRIX",
          method: "CREATE",
          raw_data: JSON.stringify(result),
          description: `Created Email Notification Matrix for module ${result.module}`,
          status_id: result.status_id,
        },
        userId,
      );

      return result;
    } catch (error) {
      logger.error("Create Email Notification Matrix failed", error);
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateEmailNotificationMatrixDto,
    userId: number,
    accessKeyId: number,
  ) {
    const header = await this.emailNotificationMatrixRepository.findOne({
      where: { id },
    });

    if (!header) {
      throw new NotFoundException(`Email Notification Matrix ${id} not found`);
    }

    Object.assign(header, {
      module: dto.module,
      smtp_email: dto.smtp_email ?? null,
      smtp_server: dto.smtp_server ?? null,
      smtp_port: dto.smtp_port ?? null,
      smtp_security: dto.smtp_security ?? null,
      smtp_auth_method: dto.smtp_auth_method ?? null,
      smtp_username: dto.smtp_username ?? null,
      smtp_password: dto.smtp_password ?? null,
      status_id: dto.status_id,
      updated_by: userId,
    });

    await this.emailNotificationMatrixRepository.save(header);

    const existingDetails =
      await this.emailNotificationMatrixDetailsRepository.find({
        where: { header_id: id },
      });

    for (const detail of existingDetails) {
      await this.emailNotificationMatrixRecipientsRepository.delete({
        line_id: detail.id,
      });
    }

    await this.emailNotificationMatrixDetailsRepository.delete({
      header_id: id,
    });

    for (const detailDto of dto.lines) {
      const detail = await this.emailNotificationMatrixDetailsRepository.save(
        this.emailNotificationMatrixDetailsRepository.create({
          header,
          email_title: detailDto.email_title,
          module: detailDto.module ? Number(detailDto.module) : dto.module,
          trigger_status_id: detailDto.trigger_status_id
            ? Number(detailDto.trigger_status_id)
            : null,
          email_format: detailDto.email_format ?? null,
          status_id: dto.status_id === 2 ? 14 : (detailDto.status_id ?? 1),
          created_by: existingDetails[0]?.created_by,
          updatedBy: { id: userId } as any,
        }),
      );

      for (const recipientDto of detailDto.recipients) {
        await this.emailNotificationMatrixRecipientsRepository.save(
          this.emailNotificationMatrixRecipientsRepository.create({
            line_id: detail.id,
            userid: Number(recipientDto.userid),
            email: recipientDto.email ?? null,
            is_approval_matrix: recipientDto.is_approval_matrix ? 1 : 0,
            module: recipientDto.module
              ? Number(recipientDto.module)
              : dto.module,
            status_id: recipientDto.status_id ?? 1,
            created_by: existingDetails[0]?.created_by,
            updatedBy: { id: userId } as any,
          }),
        );
      }
    }

    try {
      this.sseEventEmitter.emitUpdate("email-notification-matrix", id);
    } catch (err) {
      logger.error("SSE failed", err);
    }

    const result = await this.findOne(id);

    await this.userAuditTrailCreateService.create(
      {
        service: "EMAIL_NOTIFICATION_MATRIX",
        method: "UPDATE",
        raw_data: JSON.stringify(result),
        description: `Updated Email Notification Matrix for module ${result.module}`,
        status_id: result.status_id,
      },
      userId,
    );

    return result;
  }

  async toggleStatus(id: number, userId: number) {
    const emailNotificationMatrix =
      await this.emailNotificationMatrixRepository.findOne({
        where: { id },
        relations: ["status"],
      });

    if (!emailNotificationMatrix) {
      throw new NotFoundException("Email Notification Matrix not found.");
    }

    const newStatusId = emailNotificationMatrix.status_id === 1 ? 14 : 1;

    emailNotificationMatrix.status_id = newStatusId;

    await this.emailNotificationMatrixRepository.save(emailNotificationMatrix);

    // Only deactivate details and recipients when the header is being deactivated.
    // When the header is activated, keep their existing statuses.
    if (newStatusId === 14) {
      await this.emailNotificationMatrixDetailsRepository
        .createQueryBuilder()
        .update()
        .set({
          status_id: 14,
          updated_by: userId,
        })
        .where("header_id = :id", { id })
        .execute();

      await this.emailNotificationMatrixRecipientsRepository
        .createQueryBuilder()
        .update()
        .set({
          status_id: 14,
          updated_by: userId,
        })
        .where(
          `line_id IN (
        SELECT id
        FROM email_notification_matrix_details
        WHERE header_id = :id
      )`,
          { id },
        )
        .execute();
    }

    const result = await this.findOne(id);

    await this.userAuditTrailCreateService.create(
      {
        service: "EMAIL_NOTIFICATION_MATRIX",
        method: "TOGGLE_STATUS",
        raw_data: JSON.stringify(result),
        description: `Toggled Email Notification Matrix for module ${result.module}`,
        status_id: result.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdate("email-notification-matrix", id);

    return {
      message: `Email Notification Matrix successfully toggled ${
        newStatusId === 1 ? "to active" : "to deleted"
      }.`,
      emailNotificationMatrix: result,
    };
  }

  async GetbysearchAndPages(
    page: number,
    pageSize: number,
    search: string,
    statusId: number | string,
  ) {
    try {
      const query =
        this.emailNotificationMatrixRepository.createQueryBuilder("enm");

      query
        .leftJoinAndSelect("enm.status", "status")
        .leftJoinAndSelect("enm.createdBy", "createdBy")
        .leftJoinAndSelect("enm.moduleData", "moduleData")
        .leftJoinAndSelect("enm.lines", "lines");

      if (search) {
        query.andWhere(
          new Brackets((qb) => {
            qb.where("moduleData.module_name LIKE :search")
              .orWhere("enm.smtp_email LIKE :search")
              .orWhere("createdBy.first_name LIKE :search")
              .orWhere("createdBy.last_name LIKE :search");
          }),
          {
            search: `%${search}%`,
          },
        );
      }

      if (statusId) {
        query.andWhere("enm.status_id = :statusId", {
          statusId: Number(statusId),
        });
      }

      query.skip((page - 1) * pageSize);
      query.take(pageSize);
      query.orderBy("enm.id", "ASC");

      const [items, totalCount] = await query.getManyAndCount();

      return {
        items: items.map((item) => ({
          id: item.id,
          module: item.module,
          module_name: item.moduleData?.module_name || null,
          smtp_email: item.smtp_email,
          status_id: item.status_id,
          status_name: item.status?.status_name || null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          created_user: item.createdBy
            ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
            : null,
          total_lines: item.lines?.length || 0,
        })),
        totalCount,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error("Error fetching email notification matrix:", error);
      throw new Error("Failed to fetch email notification matrix");
    }
  }
}
