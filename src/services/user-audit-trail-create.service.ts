import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserAuditTrail } from "../entities/UserAuditTrail";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import logger from "src/config/logger";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";

@Injectable()
export class UserAuditTrailCreateService {
  constructor(
    @InjectRepository(UserAuditTrail)
    private userAuditTrailRepository: Repository<UserAuditTrail>,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async create(
    createDto: CreateUserAuditTrailDto,
    userId: number
  ): Promise<UserAuditTrail> {
    const audit = this.userAuditTrailRepository.create({
      ...createDto,
      created_by: userId,
    });
    try {
      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("audit_trails", 0);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }
      return await this.userAuditTrailRepository.save(audit);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
