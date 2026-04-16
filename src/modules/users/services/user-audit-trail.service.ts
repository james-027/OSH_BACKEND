import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserAuditTrail } from "../../../entities/UserAuditTrail";

@Injectable()
export class UserAuditTrailService {
  constructor(
    @InjectRepository(UserAuditTrail)
    private userAuditTrailRepository: Repository<UserAuditTrail>,
  ) {}

  async findAll(): Promise<any[]> {
    const audits = await this.userAuditTrailRepository.find({
      relations: ["status", "createdBy"],
      order: { id: "DESC" },
    });
    return audits.map((audit) => ({
      id: audit.id,
      service: audit.service,
      method: audit.method,
      raw_data: audit.raw_data,
      description: audit.description,
      status_id: audit.status_id,
      status_name: audit.status ? audit.status.status_name : null,
      created_at: audit.created_at,
      created_by: audit.created_by,
      created_user: audit.createdBy
        ? `${audit.createdBy.first_name} ${audit.createdBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const audit = await this.userAuditTrailRepository.findOne({
      where: { id },
      relations: ["status", "createdBy"],
    });
    if (!audit) throw new NotFoundException("User audit trail not found");
    return {
      id: audit.id,
      service: audit.service,
      method: audit.method,
      raw_data: audit.raw_data,
      description: audit.description,
      status_id: audit.status_id,
      status_name: audit.status ? audit.status.status_name : null,
      created_at: audit.created_at,
      created_by: audit.created_by,
      created_user: audit.createdBy
        ? `${audit.createdBy.first_name} ${audit.createdBy.last_name}`
        : null,
    };
  }
}
