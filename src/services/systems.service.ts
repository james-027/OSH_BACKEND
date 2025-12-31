import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, DataSource } from "typeorm";
import { System } from "../entities/System";
import { SystemAccessKey } from "../entities/SystemAccessKey";
import { AccessKey } from "../entities/AccessKey";
import { Status } from "../entities/Status";
import { User } from "../entities/User";
import { CreateSystemDto } from "../dto/CreateSystemDto";
import { UpdateSystemDto } from "../dto/UpdateSystemDto";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { ResponseMapperService } from "./response-mapper.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "../config/logger";

@Injectable()
export class SystemsService {
  constructor(
    @InjectRepository(System)
    private systemRepository: Repository<System>,
    @InjectRepository(SystemAccessKey)
    private systemAccessKeyRepository: Repository<SystemAccessKey>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const systems = await this.systemRepository.find({
        relations: ["status", "createdBy", "updatedBy", "system_access_keys"],
        order: { id: "ASC" },
      });

      // Return flattened response for all systems
      return Promise.all(
        systems.map((system) => this.createFlattenedResponse(system))
      );
    } catch (error) {
      logger.error("Error fetching systems:", error);
      throw new Error("Failed to fetch systems");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const system = await this.systemRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "system_access_keys"],
      });

      if (!system) {
        throw new NotFoundException(`System with ID ${id} not found`);
      }

      return this.createFlattenedResponse(system);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error fetching system:", error);
      throw new Error("Failed to fetch system");
    }
  }

  async create(createSystemDto: CreateSystemDto, userId: number): Promise<any> {
    const {
      system_name,
      system_abbr,
      access_key_ids,
      status_id = 1,
    } = createSystemDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if system with this name already exists
      const existingSystem = await this.systemRepository.findOne({
        where: { system_name },
      });

      if (existingSystem) {
        throw new BadRequestException("System with this name already exists");
      }

      // Validate user
      const createdByUser = await this.userRepository.findOneBy({ id: userId });
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Validate status
      const status = await this.statusRepository.findOneBy({ id: status_id });
      if (!status) {
        throw new BadRequestException(`Status with ID ${status_id} not found`);
      }

      // Validate all access keys exist
      const accessKeys = await this.accessKeyRepository.findBy({
        id: In(access_key_ids),
      });
      if (accessKeys.length !== access_key_ids.length) {
        const foundIds = new Set(accessKeys.map((ak) => ak.id));
        const missingIds = access_key_ids.filter((id) => !foundIds.has(id));
        throw new BadRequestException(
          `Access Key IDs not found: ${missingIds.join(", ")}`
        );
      }

      // Create system
      const newSystem = new System();
      newSystem.system_name = system_name.toUpperCase();
      newSystem.system_abbr = system_abbr.toUpperCase();
      newSystem.status_id = status_id;
      newSystem.created_by = userId;
      newSystem.updated_by = userId;
      newSystem.createdBy = createdByUser;

      const savedSystem = await queryRunner.manager.save(System, newSystem);

      // Create system access keys
      await this.createSystemAccessKeysFromPresets(
        savedSystem.id,
        access_key_ids,
        userId,
        queryRunner
      );

      await queryRunner.commitTransaction();

      // Fetch the complete system with relations
      const systemWithRelations = await this.systemRepository.findOne({
        where: { id: savedSystem.id },
        relations: ["status", "createdBy", "updatedBy", "system_access_keys"],
      });

      if (!systemWithRelations) {
        throw new Error("Failed to retrieve created system");
      }

      const response = await this.createFlattenedResponse(systemWithRelations);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SystemsService",
          method: "create",
          raw_data: JSON.stringify(savedSystem),
          description: `Created system ${savedSystem.id} - ${savedSystem.system_name}`,
          status_id: 1,
        },
        userId
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("systems", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) {
        throw error;
      }
      logger.error("Error creating system:", error);
      throw new Error("Failed to create system");
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: number,
    updateSystemDto: UpdateSystemDto,
    userId: number
  ): Promise<any> {
    const { system_name, system_abbr, access_key_ids, status_id } =
      updateSystemDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const system = await this.systemRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!system) {
        throw new NotFoundException(`System with ID ${id} not found`);
      }

      // Validate user
      const updatedByUser = await this.userRepository.findOneBy({ id: userId });
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Check for duplicate name if updating
      if (system_name && system_name !== system.system_name) {
        const existingSystem = await this.systemRepository.findOne({
          where: { system_name },
        });
        if (existingSystem) {
          throw new BadRequestException("System with this name already exists");
        }
        system.system_name = system_name.toUpperCase();
      }

      if (system_abbr) {
        system.system_abbr = system_abbr.toUpperCase();
      }

      if (status_id !== undefined) {
        const status = await this.statusRepository.findOneBy({
          id: status_id,
        });
        if (!status) {
          throw new BadRequestException(
            `Status with ID ${status_id} not found`
          );
        }
        system.status_id = status_id;
      }

      system.updated_by = userId;
      system.updatedBy = updatedByUser;

      const savedSystem = await queryRunner.manager.save(System, system);

      // Update system access keys if provided
      if (access_key_ids && access_key_ids.length > 0) {
        // Validate all access keys exist
        const accessKeys = await this.accessKeyRepository.findBy({
          id: In(access_key_ids),
        });
        if (accessKeys.length !== access_key_ids.length) {
          const foundIds = new Set(accessKeys.map((ak) => ak.id));
          const missingIds = access_key_ids.filter((id) => !foundIds.has(id));
          throw new BadRequestException(
            `Access Key IDs not found: ${missingIds.join(", ")}`
          );
        }

        // Delete existing access keys
        await queryRunner.manager.delete(SystemAccessKey, { system_id: id });

        // Create new system access keys
        await this.createSystemAccessKeysFromPresets(
          id,
          access_key_ids,
          userId,
          queryRunner
        );
      }

      await queryRunner.commitTransaction();

      // Fetch the complete system with relations
      const systemWithRelations = await this.systemRepository.findOne({
        where: { id: savedSystem.id },
        relations: ["status", "createdBy", "updatedBy", "system_access_keys"],
      });

      if (!systemWithRelations) {
        throw new Error("Failed to retrieve updated system");
      }

      const response = await this.createFlattenedResponse(systemWithRelations);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SystemsService",
          method: "update",
          raw_data: JSON.stringify(savedSystem),
          description: `Updated system ${savedSystem.id} - ${savedSystem.system_name}`,
          status_id: 1,
        },
        userId
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("systems", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error updating system:", error);
      throw new Error("Failed to update system");
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const system = await this.systemRepository.findOne({
        where: { id },
      });

      if (!system) {
        throw new NotFoundException(`System with ID ${id} not found`);
      }

      // Delete all system access keys first
      await queryRunner.manager.delete(SystemAccessKey, { system_id: id });

      // Delete system
      await queryRunner.manager.delete(System, { id });

      await queryRunner.commitTransaction();

      return { message: `System with ID ${id} successfully deleted` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error deleting system:", error);
      throw new Error("Failed to delete system");
    } finally {
      await queryRunner.release();
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const system = await this.systemRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!system) {
        throw new NotFoundException(`System with ID ${id} not found`);
      }

      // Validate user
      const updatedByUser = await this.userRepository.findOneBy({ id: userId });
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      // Determine new status
      const newStatusId = system.status_id === 1 ? 2 : 1;
      const newStatusEntity = await this.statusRepository.findOneBy({
        id: newStatusId,
      });

      if (!newStatusEntity) {
        throw new Error(
          "Target status not found in the database. Please ensure status with ID 1 and 2 exist."
        );
      }

      // Update system status
      system.status_id = newStatusId;
      system.updated_by = userId;
      system.updatedBy = updatedByUser;

      const updatedSystem = await queryRunner.manager.save(System, system);

      // Update all associated system access keys to same status
      await queryRunner.manager.update(
        SystemAccessKey,
        { system_id: id },
        {
          status_id: newStatusId,
          updated_by: userId,
          modified_at: new Date(),
        }
      );

      await queryRunner.commitTransaction();

      // Fetch the complete system with relations
      const systemWithRelations = await this.systemRepository.findOne({
        where: { id: updatedSystem.id },
        relations: ["status", "createdBy", "updatedBy", "system_access_keys"],
      });

      if (!systemWithRelations) {
        throw new Error("Failed to retrieve updated system");
      }

      const response = await this.createFlattenedResponse(systemWithRelations);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "SystemsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedSystem),
          description: `Toggled status to ${newStatusEntity.status_name} for system ${id}`,
          status_id: 1,
        },
        userId
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("systems", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      logger.error("Error toggling system status:", error);
      throw new Error("Failed to toggle system status");
    } finally {
      await queryRunner.release();
    }
  }

  // Helper method to create system access keys from provided IDs
  private async createSystemAccessKeysFromPresets(
    systemId: number,
    accessKeyIds: number[],
    createdBy: number,
    queryRunner: any
  ): Promise<void> {
    for (const accessKeyId of accessKeyIds) {
      const systemAccessKey = new SystemAccessKey();
      systemAccessKey.system_id = systemId;
      systemAccessKey.access_key_id = accessKeyId;
      systemAccessKey.status_id = 1; // Active by default
      systemAccessKey.created_by = createdBy;

      await queryRunner.manager.save(SystemAccessKey, systemAccessKey);
    }
  }

  // Create flattened response
  private async createFlattenedResponse(system: System): Promise<any> {
    const accessKeyIds = (system.system_access_keys || [])
      .filter((sak) => sak.status_id === 1)
      .map((sak) => sak.access_key_id);

    return {
      id: system.id,
      system_name: system.system_name,
      system_abbr: system.system_abbr,
      access_key_ids: accessKeyIds,
      status_id: system.status_id,
      created_at: system.created_at,
      created_by: system.created_by,
      updated_by: system.updated_by,
      modified_at: system.modified_at,
      status_name: system.status?.status_name || null,
      created_user: system.createdBy
        ? `${system.createdBy.first_name} ${system.createdBy.last_name}`
        : null,
      updated_user: system.updatedBy
        ? `${system.updatedBy.first_name} ${system.updatedBy.last_name}`
        : null,
    };
  }

  // Create nested response with access keys details
  async createNestedStructureForSystems(systems: System[]): Promise<any[]> {
    const systemAccessKeyRepository = this.systemAccessKeyRepository;

    return Promise.all(
      systems.map(async (system) => {
        // Get all active system access keys with access key details
        const systemAccessKeys = await systemAccessKeyRepository.find({
          where: { system_id: system.id, status_id: 1 },
          relations: ["accessKey"],
        });

        const accessKeys = systemAccessKeys.map((sak) => ({
          id: sak.accessKey.id,
          access_key_name: sak.accessKey.access_key_name,
          access_key_abbr: sak.accessKey.access_key_abbr,
          status_id: sak.accessKey.status_id,
        }));

        return {
          id: system.id,
          system_name: system.system_name,
          system_abbr: system.system_abbr,
          access_keys: accessKeys,
          status_id: system.status_id,
          created_at: system.created_at,
          created_by: system.created_by,
          updated_by: system.updated_by,
          modified_at: system.modified_at,
          status_name: system.status?.status_name || null,
          created_user: system.createdBy
            ? `${system.createdBy.first_name} ${system.createdBy.last_name}`
            : null,
          updated_user: system.updatedBy
            ? `${system.updatedBy.first_name} ${system.updatedBy.last_name}`
            : null,
        };
      })
    );
  }

  // Nested response for single system
  async nestedBySystem(id: number): Promise<any> {
    try {
      const system = await this.systemRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!system) {
        throw new NotFoundException(`System with ID ${id} not found`);
      }

      const nestedSystems = await this.createNestedStructureForSystems([
        system,
      ]);
      return nestedSystems[0];
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      logger.error("Error fetching nested system:", error);
      throw new Error("Failed to fetch nested system");
    }
  }
}
