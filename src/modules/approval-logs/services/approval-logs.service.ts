import { Injectable, NotFoundException } from "@nestjs/common";

import { InjectRepository } from "@nestjs/typeorm";

import { Repository } from "typeorm";

import { ApprovalStagesList } from "src/entities/ApprovalStagesList";

import logger from "../../../config/logger";

@Injectable()
export class ApprovalLogsService {
  constructor(
    @InjectRepository(ApprovalStagesList)
    private approvalStagesListRepository: Repository<ApprovalStagesList>,
  ) {}

  // Fetch approval logs by debit advice header ID
  async findByHeaderId(debit_advice_id: number): Promise<any[]> {
    try {
      const approvalLogs = await this.approvalStagesListRepository.find({
        where: {
          debit_advice_id,
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
          `No approval logs found for Debit Advice ID ${debit_advice_id}`,
        );
      }

      return approvalLogs.map((item) => ({
        id: item.id,

        debit_advice_id: item.debit_advice_id,

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
}
