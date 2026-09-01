import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import {
  MasterDataSyncLog,
  MasterDataSyncType,
} from "src/entities/MasterDataSyncLog";

import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";

@Injectable()
export class MasterDataSyncLogService {
  constructor(
    @InjectRepository(MasterDataSyncLog)
    private readonly repository: Repository<MasterDataSyncLog>,

    private readonly sseEventEmitter: SSEEventEmitterHelper,
  ) {}
  async createProcessingLog(
    type: MasterDataSyncType,
    executedBy?: number,
  ): Promise<MasterDataSyncLog> {
    const log = this.repository.create({
      sync_type: type,
      execution_type: "MANUAL",
      status_id: 38,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      error_message: null,
      executed_by: executedBy ?? null,
      started_at: new Date(),
      completed_at: null,
      duration_ms: null,
    });

    const savedLog = await this.repository.save(log);

    this.sseEventEmitter.emitCreateSignal("master-data-sync-logs", savedLog.id);

    return savedLog;
  }

  async markCompleted(
    log: MasterDataSyncLog,
    result: {
      inserted: number;
      updated: number;
      skipped: number;
      errors: number;
    },
  ): Promise<MasterDataSyncLog> {
    const completedAt = new Date();

    log.status_id = 39;

    log.inserted = result.inserted;
    log.updated = result.updated;
    log.skipped = result.skipped;
    log.errors = result.errors;

    log.completed_at = completedAt;

    log.duration_ms = log.started_at
      ? completedAt.getTime() - log.started_at.getTime()
      : null;

    const savedLog = await this.repository.save(log);

    this.sseEventEmitter.emitUpdateSignal("master-data-sync-logs", savedLog.id);

    return savedLog;
  }

  async markFailed(
    log: MasterDataSyncLog,
    error: unknown,
  ): Promise<MasterDataSyncLog> {
    const completedAt = new Date();

    log.status_id = 23;

    log.error_message = error instanceof Error ? error.message : String(error);

    log.completed_at = completedAt;

    log.duration_ms = log.started_at
      ? completedAt.getTime() - log.started_at.getTime()
      : null;

    const savedLog = await this.repository.save(log);

    this.sseEventEmitter.emitUpdateSignal("master-data-sync-logs", savedLog.id);

    return savedLog;
  }

  async findLogs(
    page: number = 0,
    pageSize: number = 10,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const skip = page * pageSize;

    const query = this.repository
      .createQueryBuilder("log")
      .leftJoinAndSelect("log.status", "status")
      .orderBy("log.started_at", "DESC")
      .skip(skip)
      .take(pageSize);

    if (dateFrom) {
      query.andWhere("log.started_at >= :dateFrom", {
        dateFrom: `${dateFrom} 00:00:00`,
      });
    }

    if (dateTo) {
      query.andWhere("log.started_at < :dateTo", {
        dateTo: this.getNextDate(dateTo),
      });
    }

    const [logs, total] = await query.getManyAndCount();

    return {
      data: logs.map((log) => ({
        id: log.id,
        sync_type: log.sync_type,
        execution_type: log.execution_type,

        status_id: log.status_id,
        status_name: log.status?.status_name ?? null,

        inserted: log.inserted,
        updated: log.updated,
        skipped: log.skipped,
        errors: log.errors,

        error_message: log.error_message,

        executed_by: log.executed_by,

        started_at: log.started_at,
        completed_at: log.completed_at,
        duration_ms: log.duration_ms,

        created_at: log.created_at,
      })),

      total,
      page,
      pageSize,
    };
  }

  private getNextDate(date: string): string {
    const nextDate = new Date(`${date}T00:00:00`);

    nextDate.setDate(nextDate.getDate() + 1);

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, "0");
    const day = String(nextDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day} 00:00:00`;
  }
}
