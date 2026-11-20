import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SalesTerritory } from "../../../entities/SalesTerritory";
import { Status } from "../../../entities/Status";
import { AccessKey } from "../../../entities/AccessKey";
import { CreateSalesTerritoryDto } from "../dto/CreateSalesTerritoryDto";
import { UpdateSalesTerritoryDto } from "../dto/UpdateSalesTerritoryDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { ResponseMapperService } from "../../../services/response-mapper.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "../../../config/logger";
import { STATUS_IDS } from "../../../constants/customConstants";

@Injectable()
export class SalesTerritoriesService {
  constructor(
    @InjectRepository(SalesTerritory)
    private salesTerritoryRepository: Repository<SalesTerritory>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll(accessKeyId?: number, statusId?: number): Promise<any[]> {
    try {
      const query = this.salesTerritoryRepository
        .createQueryBuilder("st")
        .leftJoinAndSelect("st.status", "status")
        .leftJoinAndSelect("st.createdBy", "createdBy")
        .leftJoinAndSelect("st.updatedBy", "updatedBy")
        .leftJoinAndSelect("st.accessKey", "accessKey")
        .orderBy("st.id", "DESC");

      if (accessKeyId !== undefined && accessKeyId !== null) {
        query.andWhere("st.access_key_id = :accessKeyId", { accessKeyId });
      }

      if (statusId !== undefined && !isNaN(statusId)) {
        query.andWhere("st.status_id = :statusId", { statusId });
      }

      const territories = await query.getMany();

      return territories.map((territory) => ({
        id: territory.id,
        description: territory.description,
        status_id: territory.status_id,
        status_name: territory.status ? territory.status.status_name : null,
        access_key_id: territory.access_key_id,
        access_key_name: territory.accessKey
          ? territory.accessKey.access_key_name
          : null,
        access_key_abbr: territory.accessKey
          ? territory.accessKey.access_key_abbr
          : null,
        created_at: territory.created_at,
        modified_at: territory.modified_at,
        created_by: territory.created_by,
        updated_by: territory.updated_by,
        created_user: territory.createdBy
          ? `${territory.createdBy.first_name} ${territory.createdBy.last_name}`.trim()
          : null,
        updated_user: territory.updatedBy
          ? `${territory.updatedBy.first_name} ${territory.updatedBy.last_name}`.trim()
          : null,
      }));
    } catch (error) {
      logger.error("Error fetching sales territories:", error);
      throw new InternalServerErrorException(
        "Failed to fetch sales territories",
      );
    }
  }

  async findOne(id: number, accessKeyId?: number): Promise<any> {
    const where: any = { id };
    if (accessKeyId !== undefined && accessKeyId !== null) {
      where.access_key_id = accessKeyId;
    }

    const territory = await this.salesTerritoryRepository.findOne({
      where,
      relations: ["status", "createdBy", "updatedBy", "accessKey"],
    });

    if (!territory) {
      throw new NotFoundException(`Sales Territory with ID ${id} not found`);
    }

    return {
      id: territory.id,
      description: territory.description,
      status_id: territory.status_id,
      status_name: territory.status ? territory.status.status_name : null,
      access_key_id: territory.access_key_id,
      access_key_name: territory.accessKey
        ? territory.accessKey.access_key_name
        : null,
      access_key_abbr: territory.accessKey
        ? territory.accessKey.access_key_abbr
        : null,
      created_at: territory.created_at,
      modified_at: territory.modified_at,
      created_by: territory.created_by,
      updated_by: territory.updated_by,
      created_user: territory.createdBy
        ? `${territory.createdBy.first_name} ${territory.createdBy.last_name}`.trim()
        : null,
      updated_user: territory.updatedBy
        ? `${territory.updatedBy.first_name} ${territory.updatedBy.last_name}`.trim()
        : null,
    };
  }

  async create(
    dto: CreateSalesTerritoryDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const trimmedDescription = dto.description.trim();
      const effectiveAccessKeyId =
        dto.access_key_id !== undefined ? dto.access_key_id : accessKeyId;

      const dupQuery = this.salesTerritoryRepository
        .createQueryBuilder("st")
        .where("LOWER(TRIM(st.description)) = LOWER(:description)", {
          description: trimmedDescription,
        });

      if (effectiveAccessKeyId !== undefined && effectiveAccessKeyId !== null) {
        dupQuery.andWhere("st.access_key_id = :accessKeyId", {
          accessKeyId: effectiveAccessKeyId,
        });
      } else {
        dupQuery.andWhere("st.access_key_id IS NULL");
      }

      const existing = await dupQuery.getOne();
      if (existing) {
        throw new BadRequestException(
          `Sales Territory '${trimmedDescription}' already exists for this access key`,
        );
      }

      const resolvedStatusId = dto.status_id || STATUS_IDS.ACTIVE;
      const statusEntity = await this.statusRepository.findOneBy({
        id: resolvedStatusId,
      });

      if (!statusEntity) {
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found`,
        );
      }

      if (effectiveAccessKeyId) {
        const accessKeyEntity = await this.accessKeyRepository.findOneBy({
          id: effectiveAccessKeyId,
        });
        if (!accessKeyEntity) {
          throw new BadRequestException(
            `Access Key with ID ${effectiveAccessKeyId} not found`,
          );
        }
      }

      const newTerritory = this.salesTerritoryRepository.create({
        description: trimmedDescription,
        status_id: resolvedStatusId,
        access_key_id: effectiveAccessKeyId ?? null,
        created_by: userId,
        updated_by: userId,
      });

      const saved = await this.salesTerritoryRepository.save(newTerritory);

      const territoryWithRelations =
        await this.salesTerritoryRepository.findOne({
          where: { id: saved.id },
          relations: ["status", "createdBy", "updatedBy", "accessKey"],
        });

      await this.userAuditTrailCreateService.create(
        {
          service: "SalesTerritoriesService",
          method: "create",
          raw_data: JSON.stringify(territoryWithRelations),
          description: `Created sales territory: ${saved.description}`,
          status_id: STATUS_IDS.ACTIVE,
        },
        userId,
      );

      const response = territoryWithRelations
        ? {
            id: territoryWithRelations.id,
            description: territoryWithRelations.description,
            status_id: territoryWithRelations.status_id,
            status_name: territoryWithRelations.status
              ? territoryWithRelations.status.status_name
              : null,
            access_key_id: territoryWithRelations.access_key_id,
            access_key_name: territoryWithRelations.accessKey
              ? territoryWithRelations.accessKey.access_key_name
              : null,
            created_at: territoryWithRelations.created_at,
            modified_at: territoryWithRelations.modified_at,
            created_by: territoryWithRelations.created_by,
            updated_by: territoryWithRelations.updated_by,
          }
        : saved;

      try {
        this.sseEventEmitter.emitCreateSignal("sales-territories", saved.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error creating sales territory:", error);
      throw new InternalServerErrorException(
        "Failed to create sales territory",
      );
    }
  }

  async update(
    id: number,
    dto: UpdateSalesTerritoryDto,
    userId: number,
    accessKeyId?: number,
  ): Promise<any> {
    try {
      const where: any = { id };
      if (accessKeyId !== undefined && accessKeyId !== null) {
        where.access_key_id = accessKeyId;
      }

      const existing = await this.salesTerritoryRepository.findOne({ where });

      if (!existing) {
        throw new NotFoundException(`Sales Territory with ID ${id} not found`);
      }

      const effectiveAccessKeyId =
        dto.access_key_id !== undefined
          ? dto.access_key_id
          : existing.access_key_id;

      if (dto.description) {
        const trimmed = dto.description.trim();
        const dupQuery = this.salesTerritoryRepository
          .createQueryBuilder("st")
          .where("LOWER(TRIM(st.description)) = LOWER(:description)", {
            description: trimmed,
          })
          .andWhere("st.id != :id", { id });

        if (
          effectiveAccessKeyId !== undefined &&
          effectiveAccessKeyId !== null
        ) {
          dupQuery.andWhere("st.access_key_id = :accessKeyId", {
            accessKeyId: effectiveAccessKeyId,
          });
        } else {
          dupQuery.andWhere("st.access_key_id IS NULL");
        }

        const duplicate = await dupQuery.getOne();
        if (duplicate) {
          throw new BadRequestException(
            `Sales Territory '${trimmed}' already exists for this access key`,
          );
        }
        existing.description = trimmed;
      }

      if (dto.status_id !== undefined) {
        const statusEntity = await this.statusRepository.findOneBy({
          id: dto.status_id,
        });
        if (!statusEntity) {
          throw new BadRequestException(
            `Status with ID ${dto.status_id} not found`,
          );
        }
        existing.status_id = dto.status_id;
        existing.status = statusEntity;
      }

      if (dto.access_key_id !== undefined) {
        if (dto.access_key_id !== null) {
          const accessKeyEntity = await this.accessKeyRepository.findOneBy({
            id: dto.access_key_id,
          });
          if (!accessKeyEntity) {
            throw new BadRequestException(
              `Access Key with ID ${dto.access_key_id} not found`,
            );
          }
        }
        existing.access_key_id = dto.access_key_id;
      }

      existing.updated_by = userId;

      const updated = await this.salesTerritoryRepository.save(existing);

      const territoryWithRelations =
        await this.salesTerritoryRepository.findOne({
          where: { id: updated.id },
          relations: ["status", "createdBy", "updatedBy", "accessKey"],
        });

      await this.userAuditTrailCreateService.create(
        {
          service: "SalesTerritoriesService",
          method: "update",
          raw_data: JSON.stringify(territoryWithRelations),
          description: `Updated sales territory: ${updated.description}`,
          status_id: STATUS_IDS.ACTIVE,
        },
        userId,
      );

      const response = territoryWithRelations
        ? {
            id: territoryWithRelations.id,
            description: territoryWithRelations.description,
            status_id: territoryWithRelations.status_id,
            status_name: territoryWithRelations.status
              ? territoryWithRelations.status.status_name
              : null,
            access_key_id: territoryWithRelations.access_key_id,
            access_key_name: territoryWithRelations.accessKey
              ? territoryWithRelations.accessKey.access_key_name
              : null,
            created_at: territoryWithRelations.created_at,
            modified_at: territoryWithRelations.modified_at,
            created_by: territoryWithRelations.created_by,
            updated_by: territoryWithRelations.updated_by,
          }
        : updated;

      try {
        this.sseEventEmitter.emitUpdateSignal("sales-territories", updated.id);
      } catch (err) {
        logger.error("SSE update event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error updating sales territory:", error);
      throw new InternalServerErrorException(
        "Failed to update sales territory",
      );
    }
  }

  async remove(
    id: number,
    userId?: number,
    accessKeyId?: number,
  ): Promise<{ message: string }> {
    const where: any = { id };
    if (accessKeyId !== undefined && accessKeyId !== null) {
      where.access_key_id = accessKeyId;
    }

    const existing = await this.salesTerritoryRepository.findOne({ where });

    if (!existing) {
      throw new NotFoundException(`Sales Territory with ID ${id} not found`);
    }

    await this.salesTerritoryRepository.remove(existing);

    if (userId) {
      await this.userAuditTrailCreateService.create(
        {
          service: "SalesTerritoriesService",
          method: "remove",
          raw_data: JSON.stringify({ id, description: existing.description }),
          description: `Deleted sales territory: ${existing.description}`,
          status_id: STATUS_IDS.ACTIVE,
        },
        userId,
      );
    }

    try {
      this.sseEventEmitter.emitDeleteSignal("sales-territories", id);
    } catch (err) {
      logger.error("SSE delete event failed:", err);
    }

    return { message: "Sales territory deleted successfully" };
  }

  async toggleStatus(
    id: number,
    userId: number,
    targetStatusId?: number,
    accessKeyId?: number,
  ): Promise<any> {
    const where: any = { id };
    if (accessKeyId !== undefined && accessKeyId !== null) {
      where.access_key_id = accessKeyId;
    }

    const territory = await this.salesTerritoryRepository.findOne({
      where,
      relations: ["status", "createdBy", "updatedBy", "accessKey"],
    });

    if (!territory) {
      throw new NotFoundException(`Sales Territory with ID ${id} not found`);
    }

    const newStatusId =
      targetStatusId !== undefined
        ? targetStatusId
        : territory.status_id === STATUS_IDS.ACTIVE
          ? STATUS_IDS.INACTIVE
          : STATUS_IDS.ACTIVE;

    console.log(
      `Toggling status for Sales Territory ID ${id} from ${territory.status_id} to ${newStatusId}`,
    );

    await this.salesTerritoryRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });

    const updated = await this.findOne(id, accessKeyId);

    await this.userAuditTrailCreateService.create(
      {
        service: "SalesTerritoriesService",
        method: "toggleStatus",
        raw_data: JSON.stringify(updated),
        description: `${
          newStatusId === STATUS_IDS.ACTIVE ? "Activated" : "Deactivated"
        } sales territory ${territory.description}`,
        status_id: STATUS_IDS.ACTIVE,
      },
      userId,
    );

    try {
      this.sseEventEmitter.emitUpdateSignal("sales-territories", id);
    } catch (err) {
      logger.error("SSE toggle status event failed:", err);
    }

    return updated;
  }

  async bulkUploadFromExcel(
    records: Array<{
      description: string;
      status?: string | number | null;
      access_key_id?: number | null;
      __rowNum__: number;
    }>,
    userId: number,
    accessKeyId?: number,
  ): Promise<{
    total_processed: number;
    inserted_count: number;
    updated_count: number;
    inserted_row_numbers: number[];
    updated_row_numbers: number[];
    errors: Array<{ row: number; error: string }>;
    success: any[];
  }> {
    const errors: Array<{ row: number; error: string }> = [];
    const success: any[] = [];
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];

    // Preload existing sales territories scoped to access_key_id if provided
    const findOptions: any = {};
    if (accessKeyId !== undefined && accessKeyId !== null) {
      findOptions.where = { access_key_id: accessKeyId };
    }
    const existingTerritories =
      await this.salesTerritoryRepository.find(findOptions);
    const territoryMap = new Map<string, SalesTerritory>();
    for (const item of existingTerritories) {
      if (item.description) {
        territoryMap.set(item.description.trim().toUpperCase(), item);
      }
    }

    for (const record of records) {
      const rowNum = record.__rowNum__;
      const rawDesc = record.description;

      if (!rawDesc || typeof rawDesc !== "string" || rawDesc.trim() === "") {
        errors.push({
          row: rowNum,
          error: "Sales territory description is required and cannot be empty.",
        });
        continue;
      }

      const description = rawDesc.trim();
      const normKey = description.toUpperCase();
      const rowAccessKeyId =
        record.access_key_id !== undefined && record.access_key_id !== null
          ? record.access_key_id
          : (accessKeyId ?? null);

      // Resolve status
      let statusId: number = STATUS_IDS.ACTIVE;
      if (
        record.status !== null &&
        record.status !== undefined &&
        record.status !== ""
      ) {
        if (typeof record.status === "number") {
          statusId = record.status;
        } else if (typeof record.status === "string") {
          const upperStatus = record.status.trim().toUpperCase();
          if (upperStatus === "ACTIVE" || upperStatus === "1") {
            statusId = STATUS_IDS.ACTIVE;
          } else if (upperStatus === "INACTIVE" || upperStatus === "2") {
            statusId = STATUS_IDS.INACTIVE;
          } else {
            errors.push({
              row: rowNum,
              error: `Invalid STATUS '${record.status}'. Allowed values: ACTIVE, INACTIVE.`,
            });
            continue;
          }
        }
      }

      try {
        const existing = territoryMap.get(normKey);

        if (existing) {
          // Update existing
          existing.description = description;
          existing.status_id = statusId;
          if (rowAccessKeyId !== null) {
            existing.access_key_id = rowAccessKeyId;
          }
          existing.updated_by = userId;
          await this.salesTerritoryRepository.save(existing);

          updated_row_numbers.push(rowNum);
          success.push({
            id: existing.id,
            description,
            status_id: statusId,
            status_name: record.status ? record.status.toString() : "ACTIVE",
            access_key_id: existing.access_key_id,
            action: "updated",
            __rowNum__: rowNum,
          });
        } else {
          // Create new
          const newTerritory = this.salesTerritoryRepository.create({
            description,
            status_id: statusId,
            access_key_id: rowAccessKeyId,
            created_by: userId,
            updated_by: userId,
          });
          const saved = await this.salesTerritoryRepository.save(newTerritory);
          territoryMap.set(normKey, saved);

          inserted_row_numbers.push(rowNum);
          success.push({
            id: saved.id,
            description,
            status_id: statusId,
            status_name: record.status ? record.status.toString() : "ACTIVE",
            access_key_id: saved.access_key_id,
            action: "inserted",
            __rowNum__: rowNum,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ row: rowNum, error: errorMessage });
      }
    }

    if (inserted_row_numbers.length > 0 || updated_row_numbers.length > 0) {
      try {
        this.sseEventEmitter.emitCreateSignal("sales-territories", 0);
      } catch (err) {
        logger.error("SSE bulk upload signal failed:", err);
      }
    }

    return {
      total_processed: records.length,
      inserted_count: inserted_row_numbers.length,
      updated_count: updated_row_numbers.length,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
}
