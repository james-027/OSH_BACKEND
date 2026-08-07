import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Brackets } from "typeorm";

import { ApprovalMatrix } from "../../../entities/ApprovalMatrix";
import { ApprovalMatrixDetails } from "../../../entities/ApprovalMatrixDetails";
import { ApprovalMatrixLevels } from "../../../entities/ApprovalMatrixLevels";

import { CreateApprovalMatrixDto } from "../dto/CreateApprovalMatrixDto";
import { UpdateApprovalMatrixDto } from "../dto/UpdateApprovalMatrixDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { ActionLogsService } from "src/modules/actions/services/action-logs.service";

import logger from "../../../config/logger";

@Injectable()
export class ApprovalMatrixService {
  constructor(
    @InjectRepository(ApprovalMatrix)
    private approvalMatrixRepository: Repository<ApprovalMatrix>,

    @InjectRepository(ApprovalMatrixDetails)
    private approvalMatrixDetailsRepository: Repository<ApprovalMatrixDetails>,

    @InjectRepository(ApprovalMatrixLevels)
    private approvalMatrixLevelsRepository: Repository<ApprovalMatrixLevels>,

    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,

    @Inject(ActionLogsService)
    private actionLogsService: ActionLogsService,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      return await this.approvalMatrixRepository.find({
        relations: [
          "status",
          "createdBy",
          "userMaker",
          "lines",
          "lines.approvalmatrixLevel",
        ],
        order: {
          id: "ASC",
        },
      });
    } catch (error) {
      logger.error("Error fetching approval matrix", error);
      throw error;
    }
  }

  async findOne(id: number): Promise<any> {
    const data = await this.approvalMatrixRepository.findOne({
      where: { id },
      relations: [
        "status",
        "createdBy",
        "userMaker",
        "lines",
        "lines.status",
        "lines.moduleData",
        "lines.approvalmatrixLevel",
      ],
    });

    if (!data) {
      throw new NotFoundException(`Approval Matrix ${id} not found`);
    }

    return data;
  }

  async findOneHistory(ref_id: number) {
    // const module_id = 999; // change this
    const module_name = "APPROVAL MATRIX";
    return this.actionLogsService.findPerModuleRefID(module_name, ref_id);
  }

  async create(
    dto: CreateApprovalMatrixDto,
    userId: number,
    accessKeyId: number,
  ) {
    let savedHeader: any;

    try {
      const existing = await this.approvalMatrixRepository.findOne({
        where: {
          userid: dto.userid,
        },
        relations: ["userMaker"],
      });

      if (existing) {
        throw new BadRequestException(
          `Approval Matrix already exists for ${
            existing.userMaker
              ? `${existing.userMaker.first_name} ${existing.userMaker.last_name}`
              : existing.userid
          }`,
        );
      }

      const header = this.approvalMatrixRepository.create({
        userid: dto.userid,
        status_id: dto.status_id ?? 1,
        createdBy: { id: userId } as any,
      });

      savedHeader = await this.approvalMatrixRepository.save(header);

      for (const detailDto of dto.lines) {
        // Prevent duplicate approvers within the same row
        const approverIds = detailDto.approvalmatrixLevel.map(
          (x) => x.approval_id,
        );

        if (new Set(approverIds).size !== approverIds.length) {
          throw new BadRequestException(
            `Duplicate approver found for "${detailDto.approval_title}"`,
          );
        }
        const existingTitle =
          await this.approvalMatrixDetailsRepository.findOne({
            where: {
              userid: dto.userid,
              approval_title: detailDto.approval_title,
            },
          });

        if (existingTitle && existingTitle.status_id !== 14) {
          throw new BadRequestException(
            `Approval Title "${detailDto.approval_title}" already exists for this user.`,
          );
        }
        const detail = await this.approvalMatrixDetailsRepository.save(
          this.approvalMatrixDetailsRepository.create({
            header: savedHeader,
            approval_title: detailDto.approval_title,
            userid: dto.userid,
            module: Number(detailDto.module),
            status_id: detailDto.status_id ?? 1,
            createdBy: { id: userId } as any,
          }),
        );

        for (const [
          index,
          levelDto,
        ] of detailDto.approvalmatrixLevel.entries()) {
          await this.approvalMatrixLevelsRepository.save(
            this.approvalMatrixLevelsRepository.create({
              line_id: detail.id,

              level: index + 1,

              approval_id: Number(levelDto.approval_id),
              opt_approval_id: levelDto.opt_approval_id
                ? Number(levelDto.opt_approval_id)
                : null,

              approval_title: levelDto.approval_title,
              module: Number(levelDto.module),
              userid: dto.userid,

              status_id: levelDto.status_id ?? 1,

              createdBy: { id: userId } as any,
            }),
          );
        }
      }

      try {
        this.sseEventEmitter.emitCreate("approval-matrix", savedHeader.id);
      } catch (err) {
        logger.error("SSE failed", err);
      }

      const result = await this.findOne(savedHeader.id);

      await this.userAuditTrailCreateService.create(
        {
          service: "APPROVAL_MATRIX",
          method: "CREATE",
          raw_data: JSON.stringify(result),
          description: `Created Approval Matrix for ${result.userid}`,
          status_id: result.status_id,
        },
        userId,
      );

      return result;
    } catch (error) {
      logger.error("Create Approval Matrix failed", error);
      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateApprovalMatrixDto,
    userId: number,
    accessKeyId: number,
  ) {
    const header = await this.approvalMatrixRepository.findOne({
      where: { id },
    });

    if (!header) {
      throw new NotFoundException(`Approval Matrix ${id} not found`);
    }

    Object.assign(header, {
      userid: dto.userid,
      status_id: dto.status_id,
      updated_by: userId,
    });

    await this.approvalMatrixRepository.save(header);

    // 3. Process Details and Levels
    for (const detailDto of dto.lines) {
      let detail: ApprovalMatrixDetails;

      if (detailDto.id && Number(detailDto.id) > 0) {
        detail = await this.approvalMatrixDetailsRepository.findOne({
          where: { id: Number(detailDto.id) },
        });

        if (!detail) {
          throw new BadRequestException(
            `Approval Matrix Detail ${detailDto.id} not found.`,
          );
        }

        detail.approval_title = detailDto.approval_title;
        detail.userid = dto.userid;
        detail.module = Number(detailDto.module);
        detail.status_id = detailDto.status_id ?? 1;
        detail.updatedBy = { id: userId } as any;

        detail = await this.approvalMatrixDetailsRepository.save(detail);
      } else {
        detail = await this.approvalMatrixDetailsRepository.save(
          this.approvalMatrixDetailsRepository.create({
            header,
            approval_title: detailDto.approval_title,
            userid: dto.userid,
            module: Number(detailDto.module),
            status_id: detailDto.status_id ?? 1,
            createdBy: { id: userId } as any,
          }),
        );
      }
      const levelsToUpdate: {
        entity: ApprovalMatrixLevels;
        dto: any;
        index: number;
      }[] = [];
      // Get all existing levels for this detail
      const existingLevels = await this.approvalMatrixLevelsRepository.find({
        where: {
          line_id: detail.id,
        },
      });

      // IDs that came from the frontend
      const incomingLevelIds = detailDto.approvalmatrixLevel
        .filter((x) => Number(x.id) > 0)
        .map((x) => Number(x.id));

      // Delete levels removed from UI
      for (const level of existingLevels) {
        if (!incomingLevelIds.includes(level.id)) {
          await this.approvalMatrixLevelsRepository.delete(level.id);
        }
      }
      for (const [index, levelDto] of detailDto.approvalmatrixLevel.entries()) {
        console.log("=================================");
        console.log("DETAIL ID:", detail.id);
        console.log("LEVEL DTO:", {
          id: levelDto.id,
          approval_id: levelDto.approval_id,
          opt_approval_id: levelDto.opt_approval_id,
          userid: dto.userid,
          level: index + 1,
        });
        if (levelDto.id && Number(levelDto.id) > 0) {
          const level = await this.approvalMatrixLevelsRepository.findOneOrFail(
            {
              where: { id: levelDto.id },
            },
          );

          const newApprovalId = Number(levelDto.approval_id);
          const newOptApprovalId =
            levelDto.opt_approval_id && Number(levelDto.opt_approval_id) !== 0
              ? Number(levelDto.opt_approval_id)
              : null;

          // Skip if no changes detected
          if (
            level.level === index + 1 &&
            level.approval_id === newApprovalId &&
            (level.opt_approval_id ?? null) === newOptApprovalId &&
            level.approval_title === levelDto.approval_title &&
            level.module === Number(levelDto.module) &&
            level.userid === dto.userid &&
            level.status_id === (levelDto.status_id ?? 1)
          ) {
            continue;
          }

          levelsToUpdate.push({
            entity: level,
            dto: levelDto,
            index,
          });
        } else {
          console.log("INSERTING NEW LEVEL", {
            line_id: detail.id,
            approval_id: Number(levelDto.approval_id),
            opt_approval_id: Number(levelDto.opt_approval_id || 0),
          });
          await this.approvalMatrixLevelsRepository.save(
            this.approvalMatrixLevelsRepository.create({
              line_id: detail.id,
              level: index + 1,
              approval_id: Number(levelDto.approval_id),
              opt_approval_id:
                levelDto.opt_approval_id &&
                Number(levelDto.opt_approval_id) !== 0
                  ? Number(levelDto.opt_approval_id)
                  : null,
              approval_title: levelDto.approval_title,
              module: Number(detailDto.module),
              userid: dto.userid,
              status_id: levelDto.status_id ?? 1,
              createdBy: { id: userId } as any,
            }),
          );
        }
      }

      if (levelsToUpdate.length > 0) {
        // Execute key-swapping logic with FK checks temporarily disabled
        const queryRunner =
          this.approvalMatrixLevelsRepository.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Disable foreign key checks for the current session
          await queryRunner.query("SET FOREIGN_KEY_CHECKS = 0;");

          // PASS 1: Assign dummy negative values to avoid Unique Key conflict
          for (const item of levelsToUpdate) {
            console.log("UPDATING LEVEL", {
              levelId: item.entity.id,
              oldApprovalId: item.entity.approval_id,
              newApprovalId: Number(item.dto.approval_id),
            });
            await queryRunner.manager.update(
              ApprovalMatrixLevels,
              item.entity.id,

              {
                approval_id: -item.entity.id,
              },
            );
          }

          // PASS 2: Assign final accurate values
          for (const item of levelsToUpdate) {
            const newOptApprovalId =
              item.dto.opt_approval_id && Number(item.dto.opt_approval_id) !== 0
                ? Number(item.dto.opt_approval_id)
                : null;

            await queryRunner.manager.update(
              ApprovalMatrixLevels,
              item.entity.id,
              {
                level: item.index + 1,
                approval_id: Number(item.dto.approval_id),
                opt_approval_id: newOptApprovalId,
                approval_title: item.dto.approval_title,
                module: Number(item.dto.module),
                userid: dto.userid,
                status_id: item.dto.status_id ?? 1,
                updatedBy: { id: userId } as any,
              },
            );
          }

          // Re-enable foreign key checks before commit
          await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1;");
          await queryRunner.commitTransaction();
        } catch (err) {
          await queryRunner.query("SET FOREIGN_KEY_CHECKS = 1;");
          await queryRunner.rollbackTransaction();
          throw err;
        } finally {
          await queryRunner.release();
        }
      }
    }

    // Trigger SSE & Audit logs
    try {
      this.sseEventEmitter.emitUpdate("approval-matrix", id);
    } catch (err) {
      logger.error("SSE failed", err);
    }

    const result = await this.findOne(id);

    await this.userAuditTrailCreateService.create(
      {
        service: "APPROVAL_MATRIX",
        method: "UPDATE",
        raw_data: JSON.stringify(result),
        description: `Updated Approval Matrix for ${result.userid}`,
        status_id: result.status_id,
      },
      userId,
    );

    return result;
  }

  async toggleStatus(id: number, userId: number) {
    const approvalMatrix = await this.approvalMatrixRepository.findOne({
      where: { id },
      relations: ["status"],
    });

    if (!approvalMatrix) {
      throw new NotFoundException("Approval Matrix not found.");
    }

    const newStatusId = approvalMatrix.status_id === 1 ? 14 : 1;

    approvalMatrix.status_id = newStatusId;

    const updatedApprovalMatrix =
      await this.approvalMatrixRepository.save(approvalMatrix);

    // Only deactivate details and levels when the header is being deactivated.
    // When the header is activated, keep their existing statuses.
    if (newStatusId === 14) {
      await this.approvalMatrixDetailsRepository
        .createQueryBuilder()
        .update()
        .set({
          status_id: 14,
          updated_by: userId,
        })
        .where("header_id = :id", { id })
        .execute();

      await this.approvalMatrixLevelsRepository
        .createQueryBuilder()
        .update()
        .set({
          status_id: 14,
          updated_by: userId,
        })
        .where(
          `line_id IN (
        SELECT id
        FROM approval_matrix_details
        WHERE header_id = :id
      )`,
          { id },
        )
        .execute();
    }

    const result = await this.findOne(id);

    await this.userAuditTrailCreateService.create(
      {
        service: "APPROVAL_MATRIX",

        method: "TOGGLE_STATUS",

        raw_data: JSON.stringify(result),

        description: `Toggled Approval Matrix for ${result.userid}`,

        status_id: result.status_id,
      },
      userId,
    );

    this.sseEventEmitter.emitUpdate("approval-matrix", id);

    return {
      message: `Approval Matrix successfully toggled ${
        newStatusId === 1 ? "to active" : "to deleted"
      }.`,
      approvalMatrix: result,
    };
  }

  async GetbysearchAndPages(
    page: number,
    pageSize: number,
    search: string,
    statusId: number | string,
  ) {
    try {
      const query = this.approvalMatrixRepository.createQueryBuilder("am");

      query
        .leftJoinAndSelect("am.status", "status")
        .leftJoinAndSelect("am.createdBy", "createdBy")
        .leftJoinAndSelect("am.userMaker", "userMaker")
        .leftJoinAndSelect("am.lines", "lines")
        .leftJoinAndSelect("lines.moduleData", "moduleData");

      if (search) {
        query.andWhere(
          new Brackets((qb) => {
            qb.where("am.userid LIKE :search")
              .orWhere("createdBy.first_name LIKE :search")
              .orWhere("createdBy.last_name LIKE :search");
          }),
          {
            search: `%${search}%`,
          },
        );
      }

      if (statusId) {
        query.andWhere("am.status_id = :statusId", {
          statusId: Number(statusId),
        });
      }

      query.skip((page - 1) * pageSize);
      query.take(pageSize);
      query.orderBy("am.id", "ASC");

      const [items, totalCount] = await query.getManyAndCount();

      return {
        items: items.map((item) => ({
          id: item.id,
          userid: item.userid,

          user_name: item.userMaker
            ? `${item.userMaker.first_name} ${item.userMaker.last_name}`
            : null,
          status_id: item.status_id,
          status_name: item.status?.status_name || null,

          module_name: item.lines?.[0]?.moduleData?.module_name || null,

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
      logger.error("Error fetching approval matrix:", error);
      throw new Error("Failed to fetch approval matrix");
    }
  }
}
