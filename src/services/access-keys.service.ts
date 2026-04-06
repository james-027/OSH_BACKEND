import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AccessKey } from "../entities/AccessKey";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { CreateAccessKeyDto } from "../dto/CreateAccessKeyDto";
import { UpdateAccessKeyDto } from "../dto/UpdateAccessKeyDto";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";
import logger from "src/config/logger";
import { CacheInvalidationService } from "./cache-invalidation.service";

@Injectable()
export class AccessKeysService {
  constructor(
    @InjectRepository(AccessKey)
    private accessKeysRepository: Repository<AccessKey>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const accessKeys = await this.accessKeysRepository.find({
        relations: ["company", "status", "createdBy", "updatedBy"],
      });

      return accessKeys.map((accessKey) => ({
        id: accessKey.id,
        access_key_name: accessKey.access_key_name,
        access_key_abbr: accessKey.access_key_abbr,
        company_id: accessKey.company_id,
        company_name: accessKey.company ? accessKey.company.company_name : null,
        status_id: accessKey.status_id,
        created_at: accessKey.created_at,
        created_by: accessKey.created_by,
        updated_by: accessKey.updated_by,
        modified_at: accessKey.modified_at,
        created_user: accessKey.createdBy
          ? `${accessKey.createdBy.first_name} ${accessKey.createdBy.last_name}`
          : null,
        updated_user: accessKey.updatedBy
          ? `${accessKey.updatedBy.first_name} ${accessKey.updatedBy.last_name}`
          : null,
        status_name: accessKey.status ? accessKey.status.status_name : null,
      }));
    } catch (error) {
      console.error("Error fetching access keys:", error);
      throw new Error("Failed to fetch access keys");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const accessKey = await this.accessKeysRepository.findOne({
        where: { id },
        relations: ["company", "status", "createdBy", "updatedBy"],
      });

      if (!accessKey) {
        throw new NotFoundException(`Access key with ID ${id} not found`);
      }

      return {
        id: accessKey.id,
        access_key_name: accessKey.access_key_name,
        access_key_abbr: accessKey.access_key_abbr,
        company_id: accessKey.company_id,
        company_name: accessKey.company ? accessKey.company.company_name : null,
        status_id: accessKey.status_id,
        created_at: accessKey.created_at,
        created_by: accessKey.created_by,
        updated_by: accessKey.updated_by,
        modified_at: accessKey.modified_at,
        created_user: accessKey.createdBy
          ? `${accessKey.createdBy.first_name} ${accessKey.createdBy.last_name}`
          : null,
        updated_user: accessKey.updatedBy
          ? `${accessKey.updatedBy.first_name} ${accessKey.updatedBy.last_name}`
          : null,
        status_name: accessKey.status ? accessKey.status.status_name : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching access key:", error);
      throw new Error("Failed to fetch access key");
    }
  }

  async create(
    createAccessKeyDto: CreateAccessKeyDto,
    userId: number,
  ): Promise<any> {
    try {
      // Check for duplicate access key name or abbreviation
      const existingAccessKey = await this.accessKeysRepository.findOne({
        where: [
          { access_key_name: createAccessKeyDto.access_key_name },
          { access_key_abbr: createAccessKeyDto.access_key_abbr },
        ],
      });

      if (existingAccessKey) {
        throw new BadRequestException(
          "Access key with this name or abbreviation already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newAccessKey = this.accessKeysRepository.create({
        access_key_name: createAccessKeyDto.access_key_name,
        access_key_abbr: createAccessKeyDto.access_key_abbr,
        company_id: createAccessKeyDto.company_id,
        status_id: createAccessKeyDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedAccessKey = await this.accessKeysRepository.save(newAccessKey);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AccessKeysService",
          method: "create",
          raw_data: JSON.stringify(savedAccessKey),
          description: `Created access key ${savedAccessKey.id} - ${savedAccessKey.access_key_name} | ${savedAccessKey.access_key_abbr}`,
          status_id: 1,
        },
        userId,
      );

      const accessKeyWithRelations = await this.accessKeysRepository.findOne({
        where: { id: savedAccessKey.id },
        relations: ["company", "status", "createdBy", "updatedBy"],
      });

      if (!accessKeyWithRelations) {
        throw new Error("Failed to retrieve created access key");
      }

      // SSE Events
      try {
        const userIds = await this.usersService.getUserPermissionsByAccessKey(
          accessKeyWithRelations.id,
        );
        userIds.forEach((uid) => {
          this.sseEventEmitter.emitUpdateSignal("users", uid);
        });
        this.sseEventEmitter.emitCreateSignal(
          "access_keys",
          accessKeyWithRelations.id,
        );
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return {
        id: accessKeyWithRelations.id,
        access_key_name: accessKeyWithRelations.access_key_name,
        access_key_abbr: accessKeyWithRelations.access_key_abbr,
        company_id: accessKeyWithRelations.company_id,
        company_name: accessKeyWithRelations.company
          ? accessKeyWithRelations.company.company_name
          : null,
        status_id: accessKeyWithRelations.status_id,
        created_at: accessKeyWithRelations.created_at,
        created_by: accessKeyWithRelations.created_by,
        updated_by: accessKeyWithRelations.updated_by,
        modified_at: accessKeyWithRelations.modified_at,
        created_user: accessKeyWithRelations.createdBy
          ? `${accessKeyWithRelations.createdBy.first_name} ${accessKeyWithRelations.createdBy.last_name}`
          : null,
        updated_user: accessKeyWithRelations.updatedBy
          ? `${accessKeyWithRelations.updatedBy.first_name} ${accessKeyWithRelations.updatedBy.last_name}`
          : null,
        status_name: accessKeyWithRelations.status
          ? accessKeyWithRelations.status.status_name
          : null,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create access key");
    }
  }

  async update(
    id: number,
    updateAccessKeyDto: UpdateAccessKeyDto,
    userId: number,
  ): Promise<any> {
    try {
      const accessKey = await this.accessKeysRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!accessKey) {
        throw new NotFoundException(`Access key with ID ${id} not found`);
      }

      // Check for unique constraints if updating name or abbreviation
      if (
        updateAccessKeyDto.access_key_name ||
        updateAccessKeyDto.access_key_abbr
      ) {
        const whereConditions = [];
        if (updateAccessKeyDto.access_key_name) {
          whereConditions.push({
            access_key_name: updateAccessKeyDto.access_key_name,
          });
        }
        if (updateAccessKeyDto.access_key_abbr) {
          whereConditions.push({
            access_key_abbr: updateAccessKeyDto.access_key_abbr,
          });
        }

        const existingAccessKey = await this.accessKeysRepository.findOne({
          where: whereConditions,
        });

        if (existingAccessKey && existingAccessKey.id !== id) {
          throw new BadRequestException(
            "Access key with this name or abbreviation already exists",
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.accessKeysRepository.update(id, {
        ...updateAccessKeyDto,
        updated_by: userId,
      });

      // Update related user_permissions to inactive status only if access key status is being set to inactive
      if (updateAccessKeyDto.status_id !== undefined) {
        await this.accessKeysRepository.manager.query(
          "UPDATE user_permissions SET status_id = ? WHERE access_key_id = ?",
          [updateAccessKeyDto.status_id, id],
        );
      }

      const updatedAccessKey = await this.accessKeysRepository.findOne({
        where: { id },
        relations: ["company", "status", "createdBy", "updatedBy"],
      });

      if (!updatedAccessKey) {
        throw new Error("Failed to retrieve updated access key");
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AccessKeysService",
          method: "update",
          raw_data: JSON.stringify(updateAccessKeyDto),
          description: `Updated access key ${id} - ${updatedAccessKey.access_key_name} | ${updatedAccessKey.access_key_abbr}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        const userIds = await this.usersService.getUserPermissionsByAccessKey(
          updatedAccessKey.id,
        );
        userIds.forEach((uid) => {
          this.sseEventEmitter.emitUpdateSignal("users", uid);
        });
        this.sseEventEmitter.emitUpdateSignal(
          "access_keys",
          updatedAccessKey.id,
        );
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedAccessKey.id,
        access_key_name: updatedAccessKey.access_key_name,
        access_key_abbr: updatedAccessKey.access_key_abbr,
        company_id: updatedAccessKey.company_id,
        company_name: updatedAccessKey.company
          ? updatedAccessKey.company.company_name
          : null,
        status_id: updatedAccessKey.status_id,
        created_at: updatedAccessKey.created_at,
        created_by: updatedAccessKey.created_by,
        updated_by: updatedAccessKey.updated_by,
        modified_at: updatedAccessKey.modified_at,
        created_user: updatedAccessKey.createdBy
          ? `${updatedAccessKey.createdBy.first_name} ${updatedAccessKey.createdBy.last_name}`
          : null,
        updated_user: updatedAccessKey.updatedBy
          ? `${updatedAccessKey.updatedBy.first_name} ${updatedAccessKey.updatedBy.last_name}`
          : null,
        status_name: updatedAccessKey.status
          ? updatedAccessKey.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to update access key");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const accessKey = await this.accessKeysRepository.findOne({
        where: { id },
      });

      if (!accessKey) {
        throw new NotFoundException(`Access key with ID ${id} not found`);
      }

      await this.accessKeysRepository.remove(accessKey);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting access key:", error);
      throw new Error("Failed to delete access key");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const accessKey = await this.accessKeysRepository.findOne({
        where: { id },
        relations: ["company", "status", "createdBy", "updatedBy"],
      });

      if (!accessKey) {
        throw new NotFoundException(`Access key with ID ${id} not found`);
      }

      const newStatusId = accessKey.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE";

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.accessKeysRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });
      if (newStatusId !== undefined) {
        await this.accessKeysRepository.manager.query(
          "UPDATE user_permissions SET status_id = ? WHERE access_key_id = ?",
          [newStatusId, id],
        );
      }
      const updatedAccessKey = await this.accessKeysRepository.findOne({
        where: { id },
        relations: ["company", "status", "createdBy", "updatedBy"],
      });
      if (!updatedAccessKey) {
        throw new Error("Failed to retrieve updated access key");
      }
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "AccessKeysService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedAccessKey),
          description: `Toggled status for access key ${id} - ${updatedAccessKey.access_key_name} | ${updatedAccessKey.access_key_abbr} to ${newStatusName}`,
          status_id: 1,
        },
        userId,
      );

      // SSE Events
      try {
        const userIds = await this.usersService.getUserPermissionsByAccessKey(
          updatedAccessKey.id,
        );
        userIds.forEach((uid) => {
          this.sseEventEmitter.emitUpdateSignal("users", uid);
        });
        this.sseEventEmitter.emitUpdateSignal(
          "access_keys",
          updatedAccessKey.id,
        );
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedAccessKey.id,
        access_key_name: updatedAccessKey.access_key_name,
        access_key_abbr: updatedAccessKey.access_key_abbr,
        company_id: updatedAccessKey.company_id,
        company_name: updatedAccessKey.company
          ? updatedAccessKey.company.company_name
          : null,
        status_id: updatedAccessKey.status_id,
        created_at: updatedAccessKey.created_at,
        created_by: updatedAccessKey.created_by,
        updated_by: updatedAccessKey.updated_by,
        modified_at: updatedAccessKey.modified_at,
        created_user: updatedAccessKey.createdBy
          ? `${updatedAccessKey.createdBy.first_name} ${updatedAccessKey.createdBy.last_name}`
          : null,
        updated_user: updatedAccessKey.updatedBy
          ? `${updatedAccessKey.updatedBy.first_name} ${updatedAccessKey.updatedBy.last_name}`
          : null,
        status_name: updatedAccessKey.status
          ? updatedAccessKey.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error("Failed to toggle status for access key");
    }
  }
}
