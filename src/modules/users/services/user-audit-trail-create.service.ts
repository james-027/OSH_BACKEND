import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserAuditTrail } from "../../../entities/UserAuditTrail";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";

@Injectable()
export class UserAuditTrailCreateService {
  constructor(
    @InjectRepository(UserAuditTrail)
    private userAuditTrailRepository: Repository<UserAuditTrail>,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async create(
    createDto: CreateUserAuditTrailDto,
    userId: number,
    emitSSE: boolean = true,
  ): Promise<UserAuditTrail> {
    const audit = this.userAuditTrailRepository.create({
      ...createDto,
      created_by: userId,
    });
    try {
      // SSE Events - only emit if explicitly requested (e.g., from batch operations)
      if (emitSSE) {
        try {
          this.sseEventEmitter.emitUpdateSignal("audit_trails", 0);
        } catch (err) {
          logger.error("SSE event failed for update:", err);
        }
      }
      return await this.userAuditTrailRepository.save(audit);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException(errorMessage);
    }
  }

  /**
   * Bulk create audit trail records with single consolidated SSE event
   * Used during batch operations to insert multiple audit records efficiently
   * @param createDtos Array of audit trail creation DTOs
   * @param userId User performing the operation
   * @returns Saved audit trail records (or empty array if none provided)
   */
  async bulkCreate(
    createDtos: CreateUserAuditTrailDto[],
    userId: number,
  ): Promise<UserAuditTrail[]> {
    if (!createDtos || createDtos.length === 0) {
      logger.warn(
        "[AUDIT BULK CREATE] No audit trails provided for batch creation",
      );
      return [];
    }

    try {
      // Prepare batch records with userId
      const auditRecordsToInsert = createDtos.map((dto) => ({
        ...dto,
        created_by: userId,
      }));

      // Bulk insert all at once (single database operation)
      const savedRecords =
        await this.userAuditTrailRepository.save(auditRecordsToInsert);

      // Emit SINGLE SSE event for entire batch (not per-record)
      try {
        this.sseEventEmitter.emitUpdateSignal("audit_trails", 0);
      } catch (err) {
        logger.error("SSE event failed for audit batch:", err);
      }

      logger.info(
        `[AUDIT BATCH] Inserted ${savedRecords.length} audit trail records - SINGLE SSE EVENT emitted`,
      );

      return savedRecords;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[AUDIT BATCH ERROR] Failed to batch insert audit trails: ${errorMessage}`,
      );
      // Don't throw - audit trail failure shouldn't block main transaction
      return [];
    }
  }
}
