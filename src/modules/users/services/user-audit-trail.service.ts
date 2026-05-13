import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
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

  async findAllOld(date_from?: string, date_to?: string): Promise<any[]> {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (date_from && !dateRegex.test(date_from)) {
      throw new BadRequestException(
        `Invalid date_from format. Expected YYYY-MM-DD, got ${date_from}`,
      );
    }

    if (date_to && !dateRegex.test(date_to)) {
      throw new BadRequestException(
        `Invalid date_to format. Expected YYYY-MM-DD, got ${date_to}`,
      );
    }

    // Validate date_from <= date_to if both provided
    if (date_from && date_to && date_from > date_to) {
      throw new BadRequestException(
        `date_from (${date_from}) cannot be greater than date_to (${date_to})`,
      );
    }

    // Build query with date filtering
    let query = this.userAuditTrailRepository
      .createQueryBuilder('audit')
      .leftJoinAndSelect('audit.status', 'status')
      .leftJoinAndSelect('audit.createdBy', 'createdBy');

    // Apply date range filters (filter by DATE part only, ignore time)
    if (date_from) {
      query = query.andWhere('DATE(audit.created_at) >= :dateFrom', {
        dateFrom: date_from,
      });
    }

    if (date_to) {
      query = query.andWhere('DATE(audit.created_at) <= :dateTo', {
        dateTo: date_to,
      });
    }

    // Order by created_at descending
    const audits = await query.orderBy('audit.created_at', 'DESC').getMany();

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
