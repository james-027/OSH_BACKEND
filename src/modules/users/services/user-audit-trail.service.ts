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

  async findAll(
    page: number = 0,
    pageSize: number = 10,
    sortBy: string = "created_at",
    sortOrder: "asc" | "desc" = "desc",
    searchQuery?: string,
  ): Promise<{ data: any[]; total: number }> {
    // Validate and sanitize sort parameters
    const validSortFields = [
      "id",
      "service",
      "method",
      "description",
      "created_at",
      "created_by",
    ];
    const actualSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "created_at";
    const actualSortOrder: "ASC" | "DESC" =
      sortOrder === "asc" ? "ASC" : "DESC";

    // Calculate pagination
    const skip = page * pageSize;

    // Build query with pagination and sorting
    let query = this.userAuditTrailRepository
      .createQueryBuilder("audit")
      .leftJoinAndSelect("audit.status", "status")
      .leftJoinAndSelect("audit.createdBy", "createdBy");

    // Apply search filter if provided
    if (searchQuery && searchQuery.trim()) {
      query = query.where(
        `(audit.service LIKE :search OR audit.method LIKE :search OR audit.description LIKE :search)`,
        { search: `%${searchQuery}%` },
      );
    }

    // Get total count before pagination
    const total = await query.getCount();

    // Apply sorting and pagination
    query = query
      .orderBy(`audit.${actualSortBy}`, actualSortOrder)
      .skip(skip)
      .take(pageSize);

    const audits = await query.getMany();

    return {
      data: audits.map((audit) => ({
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
      })),
      total,
    };
  }

  async findAllOld(): Promise<any[]> {
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
