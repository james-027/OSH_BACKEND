import { Injectable, NotFoundException } from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Not, Repository } from "typeorm";

import { ApprovalStagesList } from "src/entities/ApprovalStagesList";

import logger from "../../../config/logger";
import { ApprovalMatrix } from "src/entities/ApprovalMatrix";
import { CreateApprovalStagesDto } from "../dto/CreateApprovalStagesDto";
import { BadRequestException } from "@nestjs/common";
@Injectable()
export class ApprovalLogsService {
  constructor(
    @InjectRepository(ApprovalStagesList)
    private approvalStagesListRepository: Repository<ApprovalStagesList>,

    @InjectRepository(ApprovalMatrix)
    private approvalMatrixRepository: Repository<ApprovalMatrix>,
  ) { }

  // Fetch approval logs by debit advice header ID
  async findByHeaderId(transaction_id: number): Promise<any[]> {
    try {
      const approvalLogs = await this.approvalStagesListRepository.find({
        where: {
          transaction_id,
        },

        relations: [
          "status",
          "approver",
          "optionalApprover",
          "createdBy",
          "updatedBy",
        ],

        order: {
          series: "ASC",
        },
      });

      if (!approvalLogs.length) {
        throw new NotFoundException(
          `No approval logs found for Debit Advice ID ${transaction_id}`,
        );
      }

      return approvalLogs.map((item) => ({
        id: item.id,
        approval_cycle: item.approval_cycle,
        transaction_id: item.transaction_id,

        document_number: item.document_number,

        transaction_date: item.transaction_date,

        series: item.series,

        approval_date: item.approval_date,

        approverid: item.approverid,

        approver_name: item.approver
          ? `${item.approver.first_name} ${item.approver.last_name}`
          : null,

        approverid_opt: item.approverid_opt,

        optional_approver_name: item.optionalApprover
          ? `${item.optionalApprover.first_name} ${item.optionalApprover.last_name}`
          : null,

        approval_remarks: item.approval_remarks,

        status_id: item.status_id,

        status_name: item.status ? item.status.status_name : null,

        created_by: item.created_by,

        created_user: item.createdBy
          ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
          : null,

        updated_by: item.updated_by,

        updated_user: item.updatedBy
          ? `${item.updatedBy.first_name} ${item.updatedBy.last_name}`
          : null,

        created_at: item.created_at,

        updated_at: item.updated_at,
      }));
    } catch (error) {
      logger.error("Error fetching approval logs:", error);

      throw error;
    }
  }

  async initialize(dto: CreateApprovalStagesDto, userId: number) {
    const latestStage = await this.approvalStagesListRepository.findOne({
      where: {
        transaction_id: dto.transaction_id,
        module: dto.module_id,
      },
      order: {
        approval_cycle: "DESC",
      },
    });

    const nextCycle = latestStage ? latestStage.approval_cycle + 1 : 1;
    const matrix = await this.approvalMatrixRepository.findOne({
      where: {
        userid: userId,
        status_id: 1,
      },

      relations: ["lines", "lines.approvalmatrixLevel"],
    });

    if (!matrix) {
      throw new BadRequestException(
        "User is not assigned to an active Approval Matrix.",
      );
    }

    const moduleLine = matrix.lines.find(
      (x) =>
        Number(x.module) === Number(dto.module_id) && Number(x.id) === Number(dto.approval_id),
    );

    if (!moduleLine) {
      throw new BadRequestException(
        "No active Approval Matrix setup found for this module.",
      );
    }

    const existing = await this.approvalStagesListRepository.count({
      where: {
        transaction_id: dto.transaction_id,
        module: dto.module_id,
      },
    });

    const latestCycleStage = await this.approvalStagesListRepository.findOne({
      where: {
        transaction_id: dto.transaction_id,
        module: dto.module_id,
      },
      order: {
        approval_cycle: "DESC",
        id: "DESC",
      },
    });

    if (
      latestCycleStage &&
      latestCycleStage.status_id !== 15 // Rejected
    ) {
      throw new BadRequestException(
        "Approval stages already exist and are still active.",
      );
    }

    const levels = [...moduleLine.approvalmatrixLevel].sort(
      (a, b) => a.level - b.level,
    );

    for (const level of levels) {
      await this.approvalStagesListRepository.save({
        transaction_id: dto.transaction_id,
        module: dto.module_id,
        document_number: dto.document_number,
        transaction_date: dto.transaction_date,

        approval_cycle: nextCycle,

        series: level.level,
        approverid: String(level.approval_id),
        approverid_opt: level.opt_approval_id
          ? String(level.opt_approval_id)
          : null,

        status_id: 3,
        created_by: userId,
      });
    }

    return {
      success: true,
      stages_created: levels.length,
    };
  }
}
