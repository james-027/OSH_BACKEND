import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CrewHubSystem } from "src/entities/CrewHubSystem";
import { LearningMaterial } from "src/entities/LearningMaterial";
import { LearningMaterialType } from "src/entities/LearningMaterialType";
import { CreateCrewHubSystemDto } from "../dto/create-crew-hub-system.dto";
import { UpdateCrewHubSystemDto } from "../dto/update-crew-hub-system.dto";
import { CreateLearningMaterialDto } from "../dto/create-learning-material.dto";
import { UpdateLearningMaterialDto } from "../dto/update-learning-material.dto";
import {
  QueryCrewHubMaterialDto,
  QueryCrewHubSystemDto,
} from "../dto/query-crew-hub.dto";
import { CacheInvalidationService } from "src/modules/cache/services/cache-invalidation.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
import logger from "src/config/logger";

@Injectable()
export class CrewHubService {
  constructor(
    @InjectRepository(CrewHubSystem)
    private readonly systemRepo: Repository<CrewHubSystem>,

    @InjectRepository(LearningMaterial)
    private readonly materialRepo: Repository<LearningMaterial>,

    @InjectRepository(LearningMaterialType)
    private readonly materialTypeRepo: Repository<LearningMaterialType>,

    @Optional()
    private readonly cacheInvalidationService?: CacheInvalidationService,

    @Optional()
    private readonly sseEventEmitter?: SSEEventEmitterHelper,

    @Optional()
    private readonly userAuditTrailService?: UserAuditTrailCreateService,
  ) {}

  // ==========================================
  // Public Portal Methods (Optimized for Crew)
  // ==========================================

  /**
   * Get all active systems for the crew portal launcher cards.
   */
  async getPublicSystems(): Promise<CrewHubSystem[]> {
    return this.systemRepo.find({
      where: { system_status: 1 },
      order: { order_seq: "ASC", system_name: "ASC" },
    });
  }

  /**
   * Get all active and currently valid learning materials/videos.
   * Automatically filters out expired or future-scheduled materials.
   */
  async getPublicMaterials(
    query?: QueryCrewHubMaterialDto,
  ): Promise<LearningMaterial[]> {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const qb = this.materialRepo
      .createQueryBuilder("mat")
      .leftJoinAndSelect("mat.type", "type")
      .where("mat.learning_material_status = :status", { status: 1 })
      .andWhere(
        "(mat.learning_material_start_date IS NULL OR mat.learning_material_start_date <= :today)",
        { today },
      )
      .andWhere(
        "(mat.learning_material_end_date IS NULL OR mat.learning_material_end_date >= :today)",
        { today },
      );

    if (query?.type_id) {
      qb.andWhere("mat.learning_material_type_id = :typeId", {
        typeId: query.type_id,
      });
    }

    if (query?.search) {
      qb.andWhere(
        "(mat.learning_material_name LIKE :search OR mat.learning_material_description LIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy("mat.order_seq", "ASC").addOrderBy("mat.id", "DESC");

    return qb.getMany();
  }

  /**
   * Get all active learning material types (e.g. Video, Document, Guide).
   */
  async getMaterialTypes(): Promise<LearningMaterialType[]> {
    return this.materialTypeRepo.find({
      where: { status: 1 },
      order: { id: "ASC" },
    });
  }

  /**
   * Combined overview payload for initial landing page render.
   * Single roundtrip reduces latency and frontend loading states.
   */
  async getOverview(): Promise<{
    systems: CrewHubSystem[];
    materials: LearningMaterial[];
    types: LearningMaterialType[];
  }> {
    const [systems, materials, types] = await Promise.all([
      this.getPublicSystems(),
      this.getPublicMaterials(),
      this.getMaterialTypes(),
    ]);

    return { systems, materials, types };
  }

  // ==========================================
  // Systems Management (Admin)
  // ==========================================

  async getAdminSystems(
    query?: QueryCrewHubSystemDto,
  ): Promise<CrewHubSystem[]> {
    const qb = this.systemRepo.createQueryBuilder("sys");

    if (query?.search) {
      qb.andWhere(
        "(sys.system_name LIKE :search OR sys.system_abbr LIKE :search OR sys.system_description LIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    if (query?.include_inactive !== "true") {
      qb.andWhere("sys.system_status = :status", { status: 1 });
    }

    qb.orderBy("sys.order_seq", "ASC").addOrderBy("sys.system_name", "ASC");

    return qb.getMany();
  }

  async getSystemById(id: number): Promise<CrewHubSystem> {
    const system = await this.systemRepo.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy"],
    });

    if (!system) {
      throw new NotFoundException(`Crew hub system with ID ${id} not found`);
    }

    return system;
  }

  async createSystem(
    dto: CreateCrewHubSystemDto,
    userId?: number,
  ): Promise<CrewHubSystem> {
    const system = this.systemRepo.create({
      ...dto,
      system_abbr: dto.system_abbr.toUpperCase(),
      system_status: dto.system_status ?? 1,
      order_seq: dto.order_seq ?? 0,
      created_by: userId,
      updated_by: userId,
    });

    const saved = await this.systemRepo.save(system);
    await this.afterChange(
      "crew_hub_systems",
      "CREATE",
      saved.id,
      saved,
      userId,
    );
    return saved;
  }

  async updateSystem(
    id: number,
    dto: UpdateCrewHubSystemDto,
    userId?: number,
  ): Promise<CrewHubSystem> {
    const existing = await this.getSystemById(id);

    if (dto.system_abbr) {
      dto.system_abbr = dto.system_abbr.toUpperCase();
    }

    Object.assign(existing, dto);
    if (userId) {
      existing.updated_by = userId;
    }

    const saved = await this.systemRepo.save(existing);
    await this.afterChange(
      "crew_hub_systems",
      "UPDATE",
      saved.id,
      saved,
      userId,
    );
    return saved;
  }

  async toggleSystemStatus(
    id: number,
    userId?: number,
  ): Promise<CrewHubSystem> {
    const existing = await this.getSystemById(id);
    existing.system_status = existing.system_status === 1 ? 0 : 1;
    if (userId) {
      existing.updated_by = userId;
    }

    const saved = await this.systemRepo.save(existing);
    await this.afterChange(
      "crew_hub_systems",
      "UPDATE",
      saved.id,
      saved,
      userId,
    );
    return saved;
  }

  async removeSystem(
    id: number,
    userId?: number,
  ): Promise<{ success: boolean }> {
    const existing = await this.getSystemById(id);
    await this.systemRepo.remove(existing);
    await this.afterChange("crew_hub_systems", "DELETE", id, null, userId);
    return { success: true };
  }

  // ==========================================
  // Learning Materials Management (Admin)
  // ==========================================

  async getAdminMaterials(
    query?: QueryCrewHubMaterialDto,
  ): Promise<LearningMaterial[]> {
    const qb = this.materialRepo
      .createQueryBuilder("mat")
      .leftJoinAndSelect("mat.type", "type")
      .leftJoinAndSelect("mat.createdBy", "createdBy")
      .leftJoinAndSelect("mat.updatedBy", "updatedBy");

    if (query?.type_id) {
      qb.andWhere("mat.learning_material_type_id = :typeId", {
        typeId: query.type_id,
      });
    }

    if (query?.search) {
      qb.andWhere(
        "(mat.learning_material_name LIKE :search OR mat.learning_material_description LIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    if (query?.include_inactive !== "true") {
      qb.andWhere("mat.learning_material_status = :status", { status: 1 });
    }

    qb.orderBy("mat.order_seq", "ASC").addOrderBy("mat.id", "DESC");

    return qb.getMany();
  }

  async getMaterialById(id: number): Promise<LearningMaterial> {
    const material = await this.materialRepo.findOne({
      where: { id },
      relations: ["type", "createdBy", "updatedBy"],
    });

    if (!material) {
      throw new NotFoundException(`Learning material with ID ${id} not found`);
    }

    return material;
  }

  async createMaterial(
    dto: CreateLearningMaterialDto,
    userId?: number,
  ): Promise<LearningMaterial> {
    // Validate type if provided
    if (dto.learning_material_type_id) {
      const typeExists = await this.materialTypeRepo.findOne({
        where: { id: dto.learning_material_type_id },
      });
      if (!typeExists) {
        throw new BadRequestException(
          `Invalid learning material type ID ${dto.learning_material_type_id}`,
        );
      }
    }

    const material = this.materialRepo.create({
      ...dto,
      learning_material_status: dto.learning_material_status ?? 1,
      order_seq: dto.order_seq ?? 0,
      created_by: userId,
      updated_by: userId,
    });

    const saved = await this.materialRepo.save(material);
    await this.afterChange(
      "learning_materials",
      "CREATE",
      saved.id,
      saved,
      userId,
    );
    return this.getMaterialById(saved.id);
  }

  async updateMaterial(
    id: number,
    dto: UpdateLearningMaterialDto,
    userId?: number,
  ): Promise<LearningMaterial> {
    const existing = await this.getMaterialById(id);

    if (
      dto.learning_material_type_id &&
      dto.learning_material_type_id !== existing.learning_material_type_id
    ) {
      const typeExists = await this.materialTypeRepo.findOne({
        where: { id: dto.learning_material_type_id },
      });
      if (!typeExists) {
        throw new BadRequestException(
          `Invalid learning material type ID ${dto.learning_material_type_id}`,
        );
      }
    }

    Object.assign(existing, dto);
    if (userId) {
      existing.updated_by = userId;
    }

    const saved = await this.materialRepo.save(existing);
    await this.afterChange(
      "learning_materials",
      "UPDATE",
      saved.id,
      saved,
      userId,
    );
    return this.getMaterialById(saved.id);
  }

  async toggleMaterialStatus(
    id: number,
    userId?: number,
  ): Promise<LearningMaterial> {
    const existing = await this.getMaterialById(id);
    existing.learning_material_status =
      existing.learning_material_status === 1 ? 2 : 1;
    if (userId) {
      existing.updated_by = userId;
    }

    const saved = await this.materialRepo.save(existing);
    await this.afterChange(
      "learning_materials",
      "UPDATE",
      saved.id,
      saved,
      userId,
    );
    return this.getMaterialById(saved.id);
  }

  async removeMaterial(
    id: number,
    userId?: number,
  ): Promise<{ success: boolean }> {
    const existing = await this.getMaterialById(id);
    await this.materialRepo.remove(existing);
    await this.afterChange("learning_materials", "DELETE", id, null, userId);
    return { success: true };
  }

  // ==========================================
  // Helper: Invalidation, Audit & SSE
  // ==========================================

  private async afterChange(
    resource: "crew_hub_systems" | "learning_materials",
    action: "CREATE" | "UPDATE" | "DELETE",
    resourceId: number,
    data: any,
    userId?: number,
  ): Promise<void> {
    // 1. Invalidate Redis Cache
    if (this.cacheInvalidationService) {
      try {
        await this.cacheInvalidationService.invalidateCrewHub();
      } catch (err) {
        logger.error("[CrewHub] Failed to invalidate cache:", err);
      }
    }

    // 2. Broadcast SSE Event to real-time clients
    if (this.sseEventEmitter) {
      try {
        if (action === "CREATE") {
          this.sseEventEmitter.emitCreate(resource, resourceId, data);
        } else if (action === "UPDATE") {
          this.sseEventEmitter.emitUpdate(resource, resourceId, data);
        } else if (action === "DELETE") {
          this.sseEventEmitter.emitDelete(resource, resourceId);
        }
      } catch (err) {
        logger.error("[CrewHub] Failed to emit SSE event:", err);
      }
    }

    // 3. User Audit Trail (if performed by authenticated user)
    if (this.userAuditTrailService && userId) {
      try {
        await this.userAuditTrailService.create(
          {
            service: "CrewHubService",
            method: action.toLowerCase(),
            raw_data: JSON.stringify(data || { id: resourceId }),
            description: `${action} on ${resource} (ID: ${resourceId})`,
            status_id: 1,
          },
          userId,
          false,
        );
      } catch (err) {
        logger.error("[CrewHub] Failed to write audit trail:", err);
      }
    }
  }
}
