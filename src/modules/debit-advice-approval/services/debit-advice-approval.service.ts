import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";

import { ApprovalStagesList } from "src/entities/ApprovalStagesList";

import {
  UpdateApprovalStagesListDto,
} from "../dto/UpdateDebitAdviceApprovalDto";

import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";

import { ActionLogsService } from "src/modules/actions/services/action-logs.service";

import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

import logger from "src/config/logger";

import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

@Injectable()
export class ApprovalStagesListService {
  constructor(
    @InjectRepository(ApprovalStagesList)
    private approvalStagesListRepository: Repository<ApprovalStagesList>,

    @Inject(UserAuditTrailCreateService)
    private auditTrailService: UserAuditTrailCreateService,

    @Inject(ActionLogsService)
    private actionLogsService: ActionLogsService,

    private sseEventEmitter: SSEEventEmitterHelper,

    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async findAll(): Promise<any[]> {
    const approvals =
      await this.approvalStagesListRepository.find({
        relations: [
          "debitAdvice",
          "status",
          "createdBy",
          "updatedBy",
          "approver",
          "optionalApprover",
        ],

        order: {
          id: "DESC",
        },
      });

    return approvals.map((approval) => ({
      id: approval.id,

      debit_advice_id:
        approval.debit_advice_id,

      document_number:
        approval.document_number,

      transaction_date:
        approval.transaction_date,

      series:
        approval.series,

      approverid:
        approval.approverid,

      approver_name:
        approval.approver
          ? `${approval.approver.first_name} ${approval.approver.last_name}`
          : null,

      approverid_opt:
        approval.approverid_opt,

      optional_approver_name:
        approval.optionalApprover
          ? `${approval.optionalApprover.first_name} ${approval.optionalApprover.last_name}`
          : null,

      approval_date:
        approval.approval_date,

      approval_remarks:
        approval.approval_remarks,

      status_id:
        approval.status_id,

      status_name:
        approval.status
          ? approval.status.status_name
          : null,

      created_at:
        approval.created_at,

      updated_at:
        approval.updated_at,

      created_by:
        approval.created_by,

      updated_by:
        approval.updated_by,
    }));
  }

  async findOne(
    id: number,
  ): Promise<any> {
    const approval =
      await this.approvalStagesListRepository.findOne({
        where: { id },

        relations: [
          "debitAdvice",
          "status",
          "createdBy",
          "updatedBy",
          "approver",
          "optionalApprover",
        ],
      });

    if (!approval) {
      throw new NotFoundException(
        "Approval stage not found",
      );
    }

    return approval;
  }

  async update(
    id: number,

    updateDto: UpdateApprovalStagesListDto,

    userId: number,

    createAuditTrail: boolean = true,
  ): Promise<ApprovalStagesList> {
    const approval =
      await this.approvalStagesListRepository.findOne({
        where: { id },
      });

    if (!approval) {
      throw new NotFoundException(
        "Approval stage not found",
      );
    }

    if (
      updateDto.series &&
      updateDto.debit_advice_id
    ) {
      const exists =
        await this.approvalStagesListRepository.findOne({
          where: {
            debit_advice_id:
              updateDto.debit_advice_id,

            series:
              updateDto.series,

            id:
              Not(id),
          },
        });

      if (exists) {
        throw new BadRequestException(
          `Series ${updateDto.series} already exists for this debit advice`,
        );
      }
    }

    Object.assign(
      approval,
      updateDto,
      {
        updated_by:
          userId,
      },
    );

    const saved =
      await this.approvalStagesListRepository.save(
        approval,
      );

    // ACTION LOG
    await this.actionLogsService.logAction({
      action_id: 2,

      ref_id: saved.id,

      module_id: 17,

      description:
        `Updated approval stage`,

      raw_data:
        JSON.stringify(updateDto),

      created_by:
        userId,
    });

    // AUDIT TRAIL
    if (createAuditTrail) {
      await this.auditTrailService.create(
        {
          service:
            "ApprovalStagesListService",

          method:
            "update",

          raw_data:
            JSON.stringify(updateDto),

          description:
            `Updated approval stage id ${id}`,

          status_id: 1,
        },

        userId,
      );
    }

    // SSE EVENTS
    try {
      await this.cacheInvalidationService.invalidateApprovalStagesList();

      this.sseEventEmitter.emitUpdateSignal(
        "approval-stageslist",
        saved.id,
      );
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return saved;
  }

  async remove(
    id: number,
  ): Promise<void> {
    const approval =
      await this.approvalStagesListRepository.findOne({
        where: { id },
      });

    if (!approval) {
      throw new NotFoundException(
        "Approval stage not found",
      );
    }

    await this.approvalStagesListRepository.remove(
      approval,
    );
  }
  

  async toggleStatus(
    id: number,

    userId: number,

    status_id: number,

    approval_remarks?: string,
  ): Promise<any> {
    const approval =
      await this.approvalStagesListRepository.findOne({
        where: { id },
      });

    if (!approval) {
      throw new NotFoundException(
        `Approval stage with ID ${id} not found`,
      );
    }

    let newStatusName =
      "Pending";

    if (status_id === 7)
      newStatusName =
        "Approved";

    else if (status_id === 15)
      newStatusName =
        "Rejected";

    else if (status_id === 3)
      newStatusName =
        "Pending";

    await this.approvalStagesListRepository.update(
      id,
      {
        status_id,

        approval_remarks:
          approval_remarks || null,

        approval_date:
          new Date(),

        updated_by:
          userId,
      },
    );

    // AUDIT TRAIL
    await this.auditTrailService.create(
      {
        service:
          "ApprovalStagesListService",

        method:
          "toggleStatus",

        raw_data:
          JSON.stringify({
            id,
            status_id,
          }),

        description:
          `Toggled approval stage status to ${newStatusName}`,

        status_id: 1,
      },

      userId,
    );

    // ACTION LOG
    const action_id =
      await this.actionLogsService.get_action_id_from_status(
        status_id,
      );

    await this.actionLogsService.logAction({
      action_id,

      ref_id: id,

      module_id: 17,

      description:
        `${newStatusName} ${
          approval_remarks
            ? `with remarks: ${approval_remarks}`
            : ""
        }`,

      raw_data:
        JSON.stringify({
          id,
          status_id,
        }),

      created_by:
        userId,
    });

      // SSE EVENTS
      try {
        await this.cacheInvalidationService.invalidateApprovalStagesList();

        this.sseEventEmitter.emitUpdateSignal(
          "approval-stageslist",
          id,
        );
      } catch (err) {
        logger.error("[SSE] SSE event failed for update:", err);
      }

    return this.findOne(id);
  }

  async toggleBulkStatus(
    ids: number[],

    status_id: number,

    userId: number,

    approval_remarks?: string,
  ): Promise<any[]> {
    if (
      !ids ||
      !Array.isArray(ids) ||
      ids.length === 0
    ) {
      throw new BadRequestException(
        "No approval stage IDs provided",
      );
    }

    await this.approvalStagesListRepository
      .createQueryBuilder()
      .update()
      .set({
        status_id,

        updated_by:
          userId,

        approval_remarks:
          approval_remarks || null,

        approval_date:
          new Date(),
      })
      .whereInIds(ids)
      .execute();

    let newStatusName =
      "Pending";

    if (status_id === 7)
      newStatusName =
        "Approved";

    else if (status_id === 15)
      newStatusName =
        "Rejected";
        
    const action_id =
      await this.actionLogsService.get_action_id_from_status(
        status_id,
      );

    for (const id of ids) {
      await this.actionLogsService.logAction({
        action_id,

        ref_id: id,

        module_id: 17,

        description:
          `${newStatusName}`,

        raw_data:
          JSON.stringify({
            id,
            status_id,
          }),

        created_by:
          userId,
      });
    }

    // AUDIT TRAIL
    await this.auditTrailService.create(
      {
        service:
          "ApprovalStagesListService",

        method:
          "toggleBulkStatus",

        raw_data:
          JSON.stringify({
            ids,
            status_id,
          }),

        description:
          `Bulk updated approval stages`,

        status_id: 1,
      },

      userId,
    );

        // SSE EVENTS
      try {
        await this.cacheInvalidationService.invalidateApprovalStagesList();

        this.sseEventEmitter.emitUpdateSignal(
          "approval-stageslist",
          0,
        );
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

    return Promise.all(
      ids.map((id) =>
        this.findOne(id),
      ),
    );
  }

  async findOneHistory(
    ref_id: number,
  ) {
    const module_id = 17;

    return this.actionLogsService.findPerModuleRefID(
      module_id,
      ref_id,
    );
  }
}