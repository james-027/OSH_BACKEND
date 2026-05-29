import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ActionLog } from "src/entities/ActionLog";
import { CreateActionLogDto } from "../dto/CreateActionLogDto";
import { UpdateActionLogDto } from "../dto/UpdateActionLogDto";

@Injectable()
export class ActionLogsService {
  constructor(
    @InjectRepository(ActionLog)
    private readonly actionLogRepository: Repository<ActionLog>,
  ) {}

  async create(createActionLogDto: CreateActionLogDto, created_by: number) {
    const actionLog = this.actionLogRepository.create({
      ...createActionLogDto,
      created_by,
      status_id: 1,
    });
    return this.actionLogRepository.save(actionLog);
  }

  async findAll() {
    return this.actionLogRepository.find();
  }

  async findOne(id: number) {
    return this.actionLogRepository.findOneBy({ id });
  }

  async findPerModuleRefID(module_id: number, ref_id: number) {
    const logs = await this.actionLogRepository.find({
      where: { module_id, ref_id },
      relations: ["action", "createdBy"],
      order: { created_at: "DESC" },
    });

    if (!logs || logs.length === 0) {
      return [];
    }

    return logs.map((log) => ({
      id: log.id,
      module_id: log.module_id,
      module_name: log.module?.module_name,
      ref_id: log.ref_id,
      action_id: log.action_id,
      action_name: log.action?.action_name,
      description: log.description,
      raw_data: log.raw_data,
      createdBy: log.createdBy
        ? {
            full_name: `${log.createdBy.first_name} ${log.createdBy.last_name}`,
          }
        : null,
      created_at: log.created_at,
    }));
  }

  async update(
    id: number,
    updateActionLogDto: UpdateActionLogDto,
    updated_by: number,
  ) {
    await this.actionLogRepository.update(id, {
      ...updateActionLogDto,
      updated_by,
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.actionLogRepository.delete(id);
  }

  async logAction(params: {
    module_id: number;
    ref_id: number;
    action_id: number;
    description: string;
    raw_data?: any;
    created_by: number;
  }) {
    const actionLog = this.actionLogRepository.create({
      ...params,
      status_id: 1,
    });
    return this.actionLogRepository.save(actionLog);
  }

  /**
   * Batch insert action logs for optimized DB performance
   * Used when logging multiple actions at once (e.g., bulk upload)
   */
  async logActionBatch(logs: Array<{
    module_id: number;
    ref_id: number;
    action_id: number;
    description: string;
    raw_data?: any;
    created_by: number;
  }>) {
    if (!logs || logs.length === 0) {
      return [];
    }
    const actionLogs = logs.map((log) =>
      this.actionLogRepository.create({
        ...log,
        status_id: 1,
      })
    );
    return this.actionLogRepository.save(actionLogs);
  }

  async get_action_id_from_status(status_id: number): Promise<number | null> {
    let action_id = 0;
    if (status_id === 7)
      action_id = 7; // Approve status - approve action
    else if (status_id === 3)
      action_id = 6; // Back to Pending status - deactivate action
    else if (status_id === 6)
      action_id = 5; // For Approval status - activate action
    else action_id = 1; // Pending

    return action_id;
  }
}
