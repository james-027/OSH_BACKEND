import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, DataSource } from "typeorm";
import { RoleActionPreset } from "../../../entities/RoleActionPreset";
import { Role } from "../../../entities/Role";
import { Module } from "../../../entities/Module";
import { Action } from "../../../entities/Action";
import { Status } from "../../../entities/Status";
import { User } from "../../../entities/User";
import { RoleLocationPreset } from "../../../entities/RoleLocationPreset";
import { RoleWarehousePreset } from "../../../entities/RoleWarehousePreset";
import { Location } from "../../../entities/Location";
import { Warehouse } from "../../../entities/Warehouse";
import { UserPermissions } from "../../../entities/UserPermissions";
import { UserLocations } from "../../../entities/UserLocations";
import { UserWarehouses } from "../../../entities/UserWarehouses";
import { AccessKey } from "../../../entities/AccessKey";
import { CreateRolePresetDto } from "../dto/CreateRolePresetDto";
import { UpdateRolePresetDto } from "../dto/UpdateRolePresetDto";
import logger from "../../../config/logger";
import { UpdateRoleActionPresetDto } from "src/modules/roles/dto/UpdateRoleActionPresetDto";
import { CreateRoleActionPresetDto } from "src/modules/roles/dto/CreateRoleActionPresetDto";
import { UserAuditTrailCreateService } from "../../users/services/user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "../../users/dto/CreateUserAuditTrailDto";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { SSEEmitterService } from "../../sse/services/sse-emitter.service";
import { UsersService } from "../../users/services/users.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

@Injectable()
export class RoleActionPresetsService {
  constructor(
    @InjectRepository(RoleActionPreset)
    private roleActionPresetRepository: Repository<RoleActionPreset>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RoleLocationPreset)
    private roleLocationPresetRepository: Repository<RoleLocationPreset>,
    @InjectRepository(RoleWarehousePreset)
    private roleWarehousePresetRepository: Repository<RoleWarehousePreset>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(UserLocations)
    private userLocationsRepository: Repository<UserLocations>,
    @InjectRepository(UserWarehouses)
    private userWarehousesRepository: Repository<UserWarehouses>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    private dataSource: DataSource,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private usersService: UsersService,
    private sseEmitterService: SSEEmitterService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  async findRolesNotInPresets() {
    // Get all role IDs that exist in role_action_preset table
    const existingRoleIds = await this.roleActionPresetRepository
      .createQueryBuilder("preset")
      .select("DISTINCT preset.role_id", "role_id")
      .getRawMany();

    const existingRoleIdValues = existingRoleIds.map((item) => item.role_id);

    // Get all roles that are NOT in the role_action_preset table
    const rolesNotInPresets = await this.roleRepository
      .createQueryBuilder("role")
      .leftJoinAndSelect("role.status", "status")
      .leftJoinAndSelect("role.createdBy", "createdBy")
      .leftJoinAndSelect("role.updatedBy", "updatedBy")
      .where(
        existingRoleIdValues.length > 0
          ? "role.id NOT IN (:...existingRoleIds)"
          : "1=1",
        { existingRoleIds: existingRoleIdValues },
      )
      .orderBy("role.id", "ASC")
      .getMany();

    // Return flat data structure
    return rolesNotInPresets.map((role) => ({
      id: role.id,
      role_name: role.role_name,
      role_level: role.role_level,
      status_id: role.status_id,
      created_at: role.created_at,
      created_by: role.created_by,
      updated_by: role.updated_by,
      modified_at: role.modified_at,
      created_user: role.createdBy
        ? `${role.createdBy.first_name} ${role.createdBy.last_name}`
        : null,
      updated_user: role.updatedBy
        ? `${role.updatedBy.first_name} ${role.updatedBy.last_name}`
        : null,
      status_name: role.status?.status_name || null,
    }));
  }

  async findAll() {
    // Get ALL role action presets (both active and inactive) to preserve data
    const roleActionPresets = await this.roleActionPresetRepository.find({
      relations: [
        "role",
        "module",
        "action",
        "status",
        "createdBy",
        "updatedBy",
      ],
      order: { role_id: "ASC" },
    });

    // Get ALL role location presets (both active and inactive) to preserve data
    const roleLocationPresets = await this.roleLocationPresetRepository.find({
      relations: ["role", "location", "status", "createdBy", "updatedBy"],
      where: { status_id: 1 },
      order: { role_id: "ASC" },
    });

    // Group by role_id to create flattened structure
    const roleGroupMap = new Map<number, any>();

    // Process role action presets
    roleActionPresets.forEach((preset) => {
      const roleId = preset.role_id;

      if (!roleGroupMap.has(roleId)) {
        roleGroupMap.set(roleId, {
          id: preset.id, // Use first preset id as representative id
          role_id: preset.role_id,
          module_id: preset.module_id,
          action_id: preset.action_id,
          status_id: 1, // Will be determined below based on active presets
          created_at: preset.created_at,
          created_by: preset.created_by,
          updated_by: preset.updated_by,
          modified_at: preset.modified_at,
          role_name: preset.role?.role_name || null,
          role_level: preset.role?.role_level || null,
          module_name: [],
          action_name: [],
          location_name: [],
          status_name: "ACTIVE", // Will be determined below
          created_user: preset.createdBy
            ? `${preset.createdBy.first_name} ${preset.createdBy.last_name}`
            : null,
          updated_user: preset.updatedBy
            ? `${preset.updatedBy.first_name} ${preset.updatedBy.last_name}`
            : null,
          hasActivePresets: false, // Track if this role has any active presets
        });
      }

      // Only add module names and actions from ACTIVE presets (status_id = 1)
      if (preset.status_id === 1) {
        const roleGroup = roleGroupMap.get(roleId);
        roleGroup.hasActivePresets = true;

        // Add unique module names (only from active)
        if (
          preset.module?.module_name &&
          !roleGroup.module_name.includes(preset.module.module_name)
        ) {
          roleGroup.module_name.push(preset.module.module_name);
        }

        // Add unique action names (only from active)
        if (
          preset.action?.action_name &&
          !roleGroup.action_name.includes(preset.action.action_name)
        ) {
          roleGroup.action_name.push(preset.action.action_name);
        }
      }
    });

    // Process role location presets to add location names
    // Display ALL locations (active or inactive) since they're part of role configuration
    roleLocationPresets.forEach((preset) => {
      const roleId = preset.role_id;

      if (roleGroupMap.has(roleId)) {
        const roleGroup = roleGroupMap.get(roleId);

        // Add all location names regardless of status
        // Locations should always be visible as they're part of role preset
        if (
          preset.location?.location_name &&
          !roleGroup.location_name.includes(preset.location.location_name)
        ) {
          roleGroup.location_name.push(preset.location.location_name);
        }
      }
    });

    // Determine overall status: ACTIVE if has any active presets, else INACTIVE
    const results = Array.from(roleGroupMap.values()).map((roleGroup) => {
      return {
        ...roleGroup,
        status_id: roleGroup.hasActivePresets ? 1 : 2,
        status_name: roleGroup.hasActivePresets ? "ACTIVE" : "INACTIVE",
        // Remove internal tracking field
        hasActivePresets: undefined,
      };
    });

    return results.sort((a, b) => a.role_id - b.role_id);
  }

  async findOne(id: number) {
    const roleActionPreset = await this.roleActionPresetRepository.findOne({
      where: { id, status_id: 1 },
      relations: [
        "role",
        "module",
        "action",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!roleActionPreset) {
      throw new NotFoundException(`Role action preset with ID ${id} not found`);
    }

    // Get all action presets for this role
    const allActionPresets = await this.roleActionPresetRepository.find({
      where: { role_id: roleActionPreset.role_id },
      relations: ["module", "action"],
    });

    // Get all location presets for this role
    const allLocationPresets = await this.roleLocationPresetRepository.find({
      where: { role_id: roleActionPreset.role_id },
      relations: ["location"],
    });

    return {
      id: roleActionPreset.id,
      role_id: roleActionPreset.role_id,
      module_id: roleActionPreset.module_id,
      action_id: roleActionPreset.action_id,
      status_id: roleActionPreset.status_id,
      created_at: roleActionPreset.created_at,
      created_by: roleActionPreset.created_by,
      updated_by: roleActionPreset.updated_by,
      modified_at: roleActionPreset.modified_at,
      role_name: roleActionPreset.role?.role_name || null,
      module_name: [
        ...new Set(
          allActionPresets.map((p) => p.module?.module_name).filter(Boolean),
        ),
      ],
      action_name: [
        ...new Set(
          allActionPresets.map((p) => p.action?.action_name).filter(Boolean),
        ),
      ],
      location_name: [
        ...new Set(
          allLocationPresets
            .map((p) => p.location?.location_name)
            .filter(Boolean),
        ),
      ],
      status_name: roleActionPreset.status?.status_name || null,
      created_user: roleActionPreset.createdBy
        ? `${roleActionPreset.createdBy.first_name} ${roleActionPreset.createdBy.last_name}`
        : null,
      updated_user: roleActionPreset.updatedBy
        ? `${roleActionPreset.updatedBy.first_name} ${roleActionPreset.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createRoleActionPresetDto: CreateRoleActionPresetDto,
    userId: number,
  ) {
    const {
      role_id,
      module_ids,
      action_ids,
      status_id = 1,
    } = createRoleActionPresetDto;

    const module_id = module_ids[0]; // Assuming single module for now
    const action_id = action_ids[0]; // Assuming single action for now

    // Validate entities exist
    const role = await this.roleRepository.findOne({ where: { id: role_id } });
    if (!role) {
      throw new BadRequestException(`Role with ID ${role_id} not found`);
    }

    const module = await this.moduleRepository.findOne({
      where: { id: module_id },
    });
    if (!module) {
      throw new BadRequestException(`Module with ID ${module_id} not found`);
    }

    const action = await this.actionRepository.findOne({
      where: { id: action_id },
    });
    if (!action) {
      throw new BadRequestException(`Action with ID ${action_id} not found`);
    }

    // Check if this combination already exists
    const existingPreset = await this.roleActionPresetRepository.findOne({
      where: { role_id, module_id, action_id },
    });
    if (existingPreset) {
      throw new BadRequestException(
        "Role action preset with this combination already exists.",
      );
    }

    // Find createdBy User entity
    const createdByUser = await this.userRepository.findOneBy({ id: userId });
    if (!createdByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }

    const statusEntity = await this.statusRepository.findOneBy({
      id: status_id,
    });
    if (!statusEntity) {
      throw new BadRequestException(`Status with ID ${status_id} not found.`);
    }

    const roleActionPreset = new RoleActionPreset();
    roleActionPreset.role = role;
    roleActionPreset.role_id = role.id;
    roleActionPreset.module = module;
    roleActionPreset.module_id = module.id;
    roleActionPreset.action = action;
    roleActionPreset.action_id = action.id;
    roleActionPreset.status = statusEntity;
    roleActionPreset.status_id = statusEntity.id;
    roleActionPreset.createdBy = createdByUser;
    roleActionPreset.created_by = createdByUser.id;

    const savedRoleActionPreset =
      await this.roleActionPresetRepository.save(roleActionPreset);
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "RoleActionPresetsService",
        method: "create",
        raw_data: JSON.stringify(savedRoleActionPreset),
        description: `Created role action preset ${savedRoleActionPreset.id}`,
        status_id: 1,
      },
      userId,
    );

    // Return data in the same format as findOne
    return this.findOne(savedRoleActionPreset.id);
  }

  async update(
    id: number,
    updateRoleActionPresetDto: UpdateRoleActionPresetDto,
    userId: number,
  ) {
    const { role_id, module_id, action_id, status_id } =
      updateRoleActionPresetDto;

    const roleActionPresetToUpdate =
      await this.roleActionPresetRepository.findOne({
        where: { id },
        relations: [
          "role",
          "module",
          "action",
          "status",
          "createdBy",
          "updatedBy",
        ],
      });

    if (!roleActionPresetToUpdate) {
      throw new NotFoundException("Role action preset not found for update.");
    }

    // Validate entities if provided
    if (role_id !== undefined) {
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${role_id} not found`);
      }
      roleActionPresetToUpdate.role = role;
      roleActionPresetToUpdate.role_id = role.id;
    }

    if (module_id !== undefined) {
      const module = await this.moduleRepository.findOne({
        where: { id: module_id },
      });
      if (!module) {
        throw new BadRequestException(`Module with ID ${module_id} not found`);
      }
      roleActionPresetToUpdate.module = module;
      roleActionPresetToUpdate.module_id = module.id;
    }

    if (action_id !== undefined) {
      const action = await this.actionRepository.findOne({
        where: { id: action_id },
      });
      if (!action) {
        throw new BadRequestException(`Action with ID ${action_id} not found`);
      }
      roleActionPresetToUpdate.action = action;
      roleActionPresetToUpdate.action_id = action.id;
    }

    if (status_id !== undefined) {
      const statusEntity = await this.statusRepository.findOneBy({
        id: status_id,
      });
      if (!statusEntity) {
        throw new BadRequestException(`Status with ID ${status_id} not found.`);
      }
      roleActionPresetToUpdate.status = statusEntity;
      roleActionPresetToUpdate.status_id = statusEntity.id;
    }

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    roleActionPresetToUpdate.updatedBy = updatedByUser;
    roleActionPresetToUpdate.updated_by = updatedByUser.id;

    const savedRoleActionPreset = await this.roleActionPresetRepository.save(
      roleActionPresetToUpdate,
    );
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "RoleActionPresetsService",
        method: "update",
        raw_data: JSON.stringify(roleActionPresetToUpdate),
        description: `Updated role action preset ${id}`,
        status_id: 1,
      },
      userId,
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    const roleActionPresetToRemove =
      await this.roleActionPresetRepository.findOneBy({ id });

    if (!roleActionPresetToRemove) {
      throw new NotFoundException("Role action preset not found for deletion.");
    }

    await this.roleActionPresetRepository.remove(roleActionPresetToRemove);
    return { message: "Role action preset successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const role_id = Number(id);
    const authenticatedUserId = Number(userId);
    if (isNaN(role_id)) {
      logger.warn(
        `Attempted to toggle status for role presets with invalid role_id: ${role_id}`,
      );
      throw new BadRequestException(
        "Invalid role ID provided for status toggle.",
      );
    }

    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        "Authenticated user ID is required to toggle role preset status.",
      );
    }

    try {
      // Start transaction for consistency
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Check if role exists
        const role = await this.roleRepository.findOneBy({ id: role_id });
        if (!role) {
          throw new NotFoundException(`Role with ID ${role_id} not found.`);
        }

        // Get all role action presets for this role to determine current status
        const roleActionPresets = await this.roleActionPresetRepository.find({
          where: { role_id },
          relations: ["status"],
        });

        // Get all role location presets for this role
        const roleLocationPresets =
          await this.roleLocationPresetRepository.find({
            where: { role_id },
            relations: ["status"],
          });

        if (
          roleActionPresets.length === 0 &&
          roleLocationPresets.length === 0
        ) {
          throw new NotFoundException(
            `No role presets found for role ID ${role_id}.`,
          );
        }

        // Determine new status_id based on the first preset found
        let currentStatusId =
          roleActionPresets.length > 0
            ? roleActionPresets[0].status_id
            : roleLocationPresets[0].status_id;

        let newStatusId: number;
        if (currentStatusId === 1) {
          newStatusId = 2; // Set to inactive
        } else if (currentStatusId === 2) {
          newStatusId = 1; // Set to active
        } else {
          logger.warn(
            `Role presets for role ${role_id} have an unexpected status_id: ${currentStatusId}. Defaulting to inactive (2).`,
          );
          newStatusId = 2;
        }

        const newStatusName = newStatusId === 1 ? "ACTIVE" : "INACTIVE"; // For audit trail
        const newStatusEntity = await this.statusRepository.findOneBy({
          id: newStatusId,
        });
        if (!newStatusEntity) {
          logger.error(
            `Target status ID ${newStatusId} does not exist in the database.`,
          );
          throw new Error(
            "Target status (active/inactive) not found in the database. Please ensure status with ID 1 and 2 exist.",
          );
        }

        // Get updated by user
        const updatedByUser = await this.userRepository.findOneBy({
          id: userId,
        });
        if (!updatedByUser) {
          throw new BadRequestException("Authenticated user not found.");
        }

        // Update all role action presets for this role
        await queryRunner.manager.update(
          RoleActionPreset,
          { role_id },
          {
            status_id: newStatusId,
            updated_by: authenticatedUserId,
            modified_at: new Date(),
          },
        );

        // Update all role location presets for this role
        await queryRunner.manager.update(
          RoleLocationPreset,
          { role_id },
          {
            status_id: newStatusId,
            updated_by: authenticatedUserId,
            modified_at: new Date(),
          },
        );
        await queryRunner.commitTransaction();

        // Get updated presets for response
        const updatedRoleActionPresets =
          await this.roleActionPresetRepository.find({
            where: { role_id },
            relations: [
              "role",
              "module",
              "action",
              "status",
              "createdBy",
              "updatedBy",
            ],
          });

        const updatedRoleLocationPresets =
          await this.roleLocationPresetRepository.find({
            where: { role_id },
            relations: ["role", "location", "status", "createdBy", "updatedBy"],
          });

        // Build flattened response
        const moduleNames: string[] = [];
        const actionNames: string[] = [];

        updatedRoleActionPresets.forEach((rp) => {
          if (
            rp.module?.module_name &&
            !moduleNames.includes(rp.module.module_name)
          ) {
            moduleNames.push(rp.module.module_name);
          }
          if (
            rp.action?.action_name &&
            !actionNames.includes(rp.action.action_name)
          ) {
            actionNames.push(rp.action.action_name);
          }
        });

        const locationNames: string[] = [];
        updatedRoleLocationPresets.forEach((rlp) => {
          if (
            rlp.location?.location_name &&
            !locationNames.includes(rlp.location.location_name)
          ) {
            locationNames.push(rlp.location.location_name);
          }
        });

        // Use the first preset as representative for the response
        const representativePreset =
          updatedRoleActionPresets[0] || updatedRoleLocationPresets[0];

        const flattenedResponse = {
          id: representativePreset.id,
          role_id: role_id,
          module_id:
            updatedRoleActionPresets.length > 0
              ? updatedRoleActionPresets[0].module_id
              : null,
          action_id:
            updatedRoleActionPresets.length > 0
              ? updatedRoleActionPresets[0].action_id
              : null,
          status_id: newStatusId,
          created_at: representativePreset.created_at,
          created_by: representativePreset.created_by,
          updated_by: authenticatedUserId,
          modified_at: new Date(),
          role_name: role.role_name,
          module_name: moduleNames,
          action_name: actionNames,
          location_name: locationNames,
          status_name: newStatusEntity.status_name,
          created_user: representativePreset.createdBy
            ? `${representativePreset.createdBy.first_name} ${representativePreset.createdBy.last_name}`
            : null,
          updated_user: updatedByUser
            ? `${updatedByUser.first_name} ${updatedByUser.last_name}`
            : null,
        };

        const result = {
          message: `All role presets for role ID ${role_id} successfully toggled to ${newStatusEntity.status_name}. Updated ${updatedRoleActionPresets.length} action presets and ${updatedRoleLocationPresets.length} location presets.`,
          preset: flattenedResponse,
        };

        logger.info(
          `Successfully toggled status for all role presets with role_id: ${role_id} to ${newStatusEntity.status_name} by user ${authenticatedUserId}. Updated ${updatedRoleActionPresets.length} action presets and ${updatedRoleLocationPresets.length} location presets.`,
        );

        // Audit trail
        await this.userAuditTrailCreateService.create(
          {
            service: "RoleActionPresetsService",
            method: "toggleStatus",
            raw_data: JSON.stringify({ role_id: id }),
            description: `Toggled status to ${newStatusName} for role action presets of role ${id}`,
            status_id: 1,
          },
          userId,
        );

        // SSE Events
        try {
          // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
          const userIds =
            await this.usersService.getUserPermissionsByRole(role_id);
          userIds.forEach((uid) => {
            this.sseEventEmitter.emitUpdateSignal("users", uid);
          });
          this.sseEventEmitter.emitUpdateSignal("role_presets", id);
          this.sseEventEmitter.emitUpdateSignal("roles", id);
          await this.cacheInvalidationService.invalidateFindAll("users");
        } catch (err) {
          console.warn("SSE event failed for update:", err);
        }

        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error(
        `Error toggling status for role presets with role_id ${role_id}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to toggle status for role presets with role_id ${role_id}.`,
      );
    }
  }
  // Method to get nested structure for a specific role (similar to Express nestedByRole)
  async nestedByRole(role_id: number, accessKeyId?: number): Promise<any> {
    if (isNaN(role_id)) {
      throw new BadRequestException("Invalid role ID provided.");
    }

    try {
      // Find role first to ensure role exists and role_name is always available
      const role = await this.roleRepository.findOneBy({ id: role_id });

      // Always query all active presets across all access keys for this role
      const locationWhere: any = { role_id, status_id: 1 };
      const actionWhere: any = { role_id, status_id: 1 };

      // Get role location presets
      const roleLocationPresets = await this.roleLocationPresetRepository.find({
        where: locationWhere,
        relations: ["location", "role"],
      });

      // Get role warehouse presets
      const roleWarehousePresets = await this.roleWarehousePresetRepository.find({
        where: { role_id, status_id: 1 },
        relations: ["warehouse", "role"],
      });

      // Get role action presets
      const roleActionPresets = await this.roleActionPresetRepository.find({
        where: actionWhere,
        relations: ["module", "action", "role"],
      });

      // Check if role exists
      if (!role && roleLocationPresets.length === 0 && roleActionPresets.length === 0 && roleWarehousePresets.length === 0) {
        throw new NotFoundException(`Role with ID ${role_id} not found.`);
      }

      // Group action presets and location presets by access_key
      const byAccessKey: Record<
        number,
        {
          location_ids: number[];
          warehouse_ids: number[];
          presets: Array<{
            role_id: number;
            module_ids: number;
            module_name: string;
            action_ids: number[];
            order_level: number;
          }>;
        }
      > = {};

      // Distinct access key IDs
      const allAccessKeyIds = Array.from(
        new Set([
          ...roleActionPresets.map((ap) => ap.access_key_id),
          ...roleLocationPresets.map((lp) => lp.access_key_id),
          ...roleWarehousePresets.map((wp) => wp.access_key_id),
        ]),
      );

      for (const akId of allAccessKeyIds) {
        const akActions = roleActionPresets.filter(
          (ap) => ap.access_key_id === akId,
        );
        const akLocations = roleLocationPresets
          .filter((lp) => lp.access_key_id === akId)
          .map((lp) => lp.location_id)
          .sort((a, b) => a - b);
        const akWarehouses = roleWarehousePresets
          .filter((wp) => wp.access_key_id === akId)
          .map((wp) => wp.warehouse_id)
          .sort((a, b) => a - b);

        const akModuleMap = new Map<
          number,
          { actions: number[]; module_name: string; order_level: number }
        >();

        akActions.forEach((preset) => {
          if (!akModuleMap.has(preset.module_id)) {
            akModuleMap.set(preset.module_id, {
              actions: [],
              module_name: preset.module?.module_name || "",
              order_level: preset.module?.order_level || 0,
            });
          }
          akModuleMap.get(preset.module_id)!.actions.push(preset.action_id);
        });

        const akPresets = Array.from(akModuleMap.entries()).map(
          ([module_id, data]) => ({
            role_id,
            module_ids: module_id,
            module_name: data.module_name,
            action_ids: data.actions.sort((a, b) => a - b),
            order_level: data.order_level,
          }),
        );

        byAccessKey[akId] = {
          location_ids: akLocations,
          warehouse_ids: akWarehouses,
          presets: akPresets.sort((a, b) => a.order_level - b.order_level),
        };
      }

      // Default top-level presets, locations, and warehouses (for backward compatibility)
      const defaultAkId =
        accessKeyId && byAccessKey[accessKeyId]
          ? accessKeyId
          : allAccessKeyIds[0] || accessKeyId || 1;
      const defaultData =
        byAccessKey[defaultAkId] ||
        byAccessKey[allAccessKeyIds[0]] || { location_ids: [], warehouse_ids: [], presets: [] };

      // Build response
      const response_data = {
        role_id,
        role_name:
          role?.role_name ||
          roleActionPresets[0]?.role?.role_name ||
          roleLocationPresets[0]?.role?.role_name ||
          null,
        location_ids: defaultData.location_ids,
        warehouse_ids: defaultData.warehouse_ids || [],
        presets: defaultData.presets,
        by_access_key: byAccessKey,
        access_key_ids: allAccessKeyIds,
      };

      return response_data;
    } catch (error) {
      logger.error(
        `Error retrieving role presets for role ID ${role_id}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve role presets for role ID ${role_id}.`,
      );
    }
  }
  // Method to get all nested role action presets (similar to Express nested)
  async nested(): Promise<any[]> {
    // Get all roles with their presets
    const roles = await this.roleRepository.find({
      relations: ["status", "createdBy", "updatedBy"],
    });

    const results = [];

    for (const role of roles) {
      // Get role action presets for this role
      const roleActionPresets = await this.roleActionPresetRepository.find({
        where: { role_id: role.id },
        relations: [
          "role",
          "module",
          "action",
          "status",
          "createdBy",
          "updatedBy",
        ],
      });

      // Get role location presets for this role
      const roleLocationPresets = await this.roleLocationPresetRepository.find({
        where: { role_id: role.id },
        relations: ["role", "location", "status", "createdBy", "updatedBy"],
      });

      // Get role warehouse presets for this role
      const roleWarehousePresets = await this.roleWarehousePresetRepository.find({
        where: { role_id: role.id },
        relations: ["role", "warehouse", "status", "createdBy", "updatedBy"],
      });

      // Only include roles that have presets
      if (
        roleActionPresets.length > 0 ||
        roleLocationPresets.length > 0 ||
        roleWarehousePresets.length > 0
      ) {
        const nestedRole = this.createNestedStructure(
          role,
          roleActionPresets,
          roleLocationPresets,
          roleWarehousePresets,
        );
        results.push(nestedRole);
      }
    }

    return results;
  }

  // Helper method to create nested structure (similar to Express createNestedStructure)
  private async createNestedStructureOld(
    roleActionPresets: RoleActionPreset[],
  ): Promise<any[]> {
    // Get all role location presets for completeness
    const roleLocationPresets = await this.roleLocationPresetRepository.find({
      relations: ["role", "location", "status", "createdBy", "updatedBy"],
    });

    // Group by role_id to create nested structure
    const roleGroupMap = new Map<number, any>();

    // Process role action presets
    roleActionPresets.forEach((preset) => {
      const roleId = preset.role_id;

      if (!roleGroupMap.has(roleId)) {
        roleGroupMap.set(roleId, {
          id: preset.id, // Use first preset id as representative id
          role_id: preset.role_id,
          module_id: preset.module_id,
          action_id: preset.action_id,
          status_id: preset.status_id,
          created_at: preset.created_at,
          created_by: preset.created_by,
          updated_by: preset.updated_by,
          modified_at: preset.modified_at,
          role_name: preset.role?.role_name || null,
          module_name: [],
          action_name: [],
          location_name: [],
          status_name: preset.status?.status_name || null,
          created_user: preset.createdBy
            ? `${preset.createdBy.first_name} ${preset.createdBy.last_name}`
            : null,
          updated_user: preset.updatedBy
            ? `${preset.updatedBy.first_name} ${preset.updatedBy.last_name}`
            : null,
        });
      }

      const roleGroup = roleGroupMap.get(roleId);

      // Add unique module names
      if (
        preset.module?.module_name &&
        !roleGroup.module_name.includes(preset.module.module_name)
      ) {
        roleGroup.module_name.push(preset.module.module_name);
      }

      // Add unique action names
      if (
        preset.action?.action_name &&
        !roleGroup.action_name.includes(preset.action.action_name)
      ) {
        roleGroup.action_name.push(preset.action.action_name);
      }
    });

    // Process role location presets to add location names
    roleLocationPresets.forEach((preset) => {
      const roleId = preset.role_id;

      if (roleGroupMap.has(roleId)) {
        const roleGroup = roleGroupMap.get(roleId);

        // Add unique location names
        if (
          preset.location?.location_name &&
          !roleGroup.location_name.includes(preset.location.location_name)
        ) {
          roleGroup.location_name.push(preset.location.location_name);
        }
      }
    });

    return Array.from(roleGroupMap.values());
  }

  // Helper method to create Express-style nested structure for a single role
  private async createNestedStructure(
    role: Role,
    roleActionPresets: RoleActionPreset[],
    roleLocationPresets: RoleLocationPreset[],
    roleWarehousePresets: RoleWarehousePreset[] = [],
  ): Promise<any> {
    // Group modules and their actions
    const moduleMap = new Map<number, any>();

    roleActionPresets.forEach((preset) => {
      if (preset.module) {
        const moduleId = preset.module.id;

        if (!moduleMap.has(moduleId)) {
          moduleMap.set(moduleId, {
            id: preset.module.id,
            module_name: preset.module.module_name,
            module_alias: preset.module.module_alias,
            module_link: preset.module.module_link,
            menu_title: preset.module.menu_title,
            parent_title: preset.module.parent_title,
            link_name: preset.module.link_name,
            order_level: preset.module.order_level,
            status_id: preset.module.status_id,
            created_at: preset.module.created_at,
            modified_at: preset.module.modified_at,
            actions: [],
          });
        }

        const module = moduleMap.get(moduleId);

        // Add action to the module's actions array (if not already present)
        if (
          preset.action &&
          !module.actions.find((a: any) => a.id === preset.action.id)
        ) {
          module.actions.push({
            id: preset.action.id,
            action_name: preset.action.action_name,
            status_id: preset.action.status_id,
          });
        }
      }
    });

    // Get the first preset for timing information (created_at, created_by, etc.)
    const firstPreset = roleActionPresets[0] || roleLocationPresets[0];

    return {
      role_id: role.id,
      role: {
        id: role.id,
        role_name: role.role_name,
        role_level: role.role_level,
        status_id: role.status_id,
        created_at: role.created_at,
        modified_at: role.modified_at,
      },
      modules: Array.from(moduleMap.values()),
      locations: roleLocationPresets.map((preset) => ({
        id: preset.location?.id || null,
        location_name: preset.location?.location_name || null,
        status_id: preset.location?.status_id || null,
      })),
      warehouses: roleWarehousePresets.map((preset) => ({
        id: preset.warehouse?.id || null,
        warehouse_name: preset.warehouse?.warehouse_name || null,
        warehouse_code: preset.warehouse?.warehouse_code || null,
        location_id: preset.warehouse?.location_id || null,
        status_id: preset.warehouse?.status_id || null,
      })),
      status: {
        id: role.status?.id || null,
        status_name: role.status?.status_name || null,
      },
      created_by: firstPreset?.createdBy
        ? {
            id: firstPreset.createdBy.id,
            user_name: firstPreset.createdBy.user_name,
            first_name: firstPreset.createdBy.first_name,
            last_name: firstPreset.createdBy.last_name,
            full_name: `${firstPreset.createdBy.first_name} ${firstPreset.createdBy.last_name}`,
          }
        : null,
      updated_by: firstPreset?.updatedBy
        ? {
            id: firstPreset.updatedBy.id,
            user_name: firstPreset.updatedBy.user_name,
            first_name: firstPreset.updatedBy.first_name,
            last_name: firstPreset.updatedBy.last_name,
            full_name: `${firstPreset.updatedBy.first_name} ${firstPreset.updatedBy.last_name}`,
          }
        : null,
      created_at: firstPreset?.created_at || null,
      modified_at: firstPreset?.modified_at || null,
    };
  }
  // Helper method to update role location presets (mark-inactive-then-upsert pattern)
  private async updateRoleLocationPresetsFromPresets(
    roleId: number,
    locationIds: number[],
    status: Status,
    updatedBy: number,
    queryRunner: any,
    targetAccessKeyIds: number[] = [1],
  ): Promise<RoleLocationPreset[]> {
    const role = await this.roleRepository.findOneBy({ id: roleId });
    if (!role) {
      throw new BadRequestException(`Role with ID ${roleId} not found.`);
    }

    // Validate all locations exist
    const locations = await this.locationRepository.findBy({
      id: In(locationIds),
    });
    if (locations.length !== locationIds.length) {
      const foundLocationIds = new Set(locations.map((l) => l.id));
      const missingLocationIds = locationIds.filter(
        (id: number) => !foundLocationIds.has(id),
      );
      throw new BadRequestException(
        `Location IDs not found: ${missingLocationIds.join(", ")}`,
      );
    }

    // Step 1: Mark all existing location presets for this role within target access keys as inactive
    await queryRunner.manager.update(
      RoleLocationPreset,
      { role_id: roleId, access_key_id: In(targetAccessKeyIds) },
      {
        status_id: 2, // inactive
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // Step 2: Upsert location presets for each target access key
    const savedLocationPresets: RoleLocationPreset[] = [];
    for (const accessKeyId of targetAccessKeyIds) {
      for (const locationId of locationIds) {
        const existingPreset = await queryRunner.manager.findOne(
          RoleLocationPreset,
          {
            where: {
              role_id: roleId,
              location_id: locationId,
              access_key_id: accessKeyId,
            },
          },
        );

        if (existingPreset) {
          // Update existing preset with the provided status
          await queryRunner.manager.update(
            RoleLocationPreset,
            { id: existingPreset.id },
            {
              status_id: status.id,
              updated_by: updatedBy,
              modified_at: new Date(),
            },
          );
          // Sync in-memory object with database updates
          existingPreset.status_id = status.id;
          existingPreset.updated_by = updatedBy;
          existingPreset.modified_at = new Date();
          savedLocationPresets.push(existingPreset);
        } else {
          // Create new preset
          const newLocationPreset = new RoleLocationPreset();
          newLocationPreset.role = role;
          newLocationPreset.role_id = roleId;
          newLocationPreset.location = locations.find(
            (l) => l.id === locationId,
          )!;
          newLocationPreset.location_id = locationId;
          newLocationPreset.access_key_id = accessKeyId;
          newLocationPreset.status = status;
          newLocationPreset.status_id = status.id;
          newLocationPreset.createdBy = await this.userRepository.findOneBy({
            id: updatedBy,
          });
          newLocationPreset.created_by = updatedBy;
          const saved = await queryRunner.manager.save(
            RoleLocationPreset,
            newLocationPreset,
          );
          savedLocationPresets.push(saved);
        }
      }
    }

    return savedLocationPresets;
  }

  // Helper method to update role warehouse presets with batch/in-memory optimization
  private async updateRoleWarehousePresetsFromPresets(
    roleId: number,
    warehouseIds: number[],
    status: Status,
    updatedBy: number,
    queryRunner: any,
    targetAccessKeyIds: number[] = [1],
  ): Promise<RoleWarehousePreset[]> {
    const role = await this.roleRepository.findOneBy({ id: roleId });
    if (!role) {
      throw new BadRequestException(`Role with ID ${roleId} not found.`);
    }

    // Step 1: Mark all existing warehouse presets for this role within target access keys as inactive
    await queryRunner.manager.update(
      RoleWarehousePreset,
      { role_id: roleId, access_key_id: In(targetAccessKeyIds) },
      {
        status_id: 2, // inactive (NO DELETE!)
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    if (!warehouseIds || warehouseIds.length === 0) {
      return [];
    }

    // Step 2: Validate all warehouses exist
    const warehouses = await this.warehouseRepository.findBy({
      id: In(warehouseIds),
    });
    if (warehouses.length !== warehouseIds.length) {
      const foundWarehouseIds = new Set(warehouses.map((w) => w.id));
      const missingWarehouseIds = warehouseIds.filter(
        (id: number) => !foundWarehouseIds.has(id),
      );
      throw new BadRequestException(
        `Warehouse IDs not found: ${missingWarehouseIds.join(", ")}`,
      );
    }

    // Step 3: Location Respect Validation
    // Fetch active location presets for this role and access keys from queryRunner
    const activeLocationPresets = await queryRunner.manager.find(
      RoleLocationPreset,
      {
        where: {
          role_id: roleId,
          access_key_id: In(targetAccessKeyIds),
          status_id: 1,
        },
      },
    );
    const allowedLocationIds = new Set(
      activeLocationPresets.map((lp: RoleLocationPreset) => lp.location_id),
    );

    // If active location presets exist, verify that all warehouses belong to allowed locations
    if (allowedLocationIds.size > 0) {
      const invalidWarehouses = warehouses.filter(
        (w) => !allowedLocationIds.has(w.location_id),
      );
      if (invalidWarehouses.length > 0) {
        const invalidNames = invalidWarehouses
          .map((w) => `'${w.warehouse_name}' (ID: ${w.id})`)
          .join(", ");
        throw new BadRequestException(
          `The following warehouses do not belong to the role's assigned locations: ${invalidNames}`,
        );
      }
    }

    // Step 4: Fetch existing warehouse presets in 1 query
    const existingPresets = await queryRunner.manager.find(RoleWarehousePreset, {
      where: {
        role_id: roleId,
        access_key_id: In(targetAccessKeyIds),
      },
    });

    const presetMap = new Map<string, RoleWarehousePreset>();
    existingPresets.forEach((p: RoleWarehousePreset) => {
      presetMap.set(`${p.access_key_id}_${p.warehouse_id}`, p);
    });

    // Step 5: Fast in-memory reconciliation
    const toSave: RoleWarehousePreset[] = [];
    const seen = new Set<string>();
    const createdByUser = await this.userRepository.findOneBy({ id: updatedBy });

    for (const accessKeyId of targetAccessKeyIds) {
      for (const warehouseId of warehouseIds) {
        const key = `${accessKeyId}_${warehouseId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const existing = presetMap.get(key);
        if (existing) {
          existing.status_id = status.id;
          existing.updated_by = updatedBy;
          existing.modified_at = new Date();
          toSave.push(existing);
        } else {
          const newPreset = new RoleWarehousePreset();
          newPreset.role = role;
          newPreset.role_id = roleId;
          newPreset.warehouse = warehouses.find((w) => w.id === warehouseId)!;
          newPreset.warehouse_id = warehouseId;
          newPreset.access_key_id = accessKeyId;
          newPreset.status = status;
          newPreset.status_id = status.id;
          newPreset.createdBy = createdByUser!;
          newPreset.created_by = updatedBy;
          toSave.push(newPreset);
        }
      }
    }

    if (toSave.length > 0) {
      return await queryRunner.manager.save(RoleWarehousePreset, toSave, {
        chunk: 250,
      });
    }

    return [];
  }

  // Helper method to update role action presets (mark-inactive-then-upsert pattern)
  private async updateRoleActionPresetsFromPresets(
    roleId: number,
    presets: any[],
    status: Status,
    updatedBy: number,
    queryRunner: any,
    targetAccessKeyIds: number[] = [1],
  ): Promise<RoleActionPreset[]> {
    const role = await this.roleRepository.findOneBy({ id: roleId });
    if (!role) {
      throw new BadRequestException(`Role with ID ${roleId} not found.`);
    }

    // Extract all unique module_ids and action_ids from presets
    const allModuleIds = new Set<number>();
    const allActionIds = new Set<number>();

    presets.forEach((preset) => {
      if (preset.module_ids) {
        allModuleIds.add(preset.module_ids);
      }
      if (Array.isArray(preset.action_ids)) {
        preset.action_ids.forEach((actionId: number) =>
          allActionIds.add(actionId),
        );
      }
    });

    // Validate all modules exist
    const modules = await this.moduleRepository.findBy({
      id: In(Array.from(allModuleIds)),
    });
    if (modules.length !== allModuleIds.size) {
      const foundModuleIds = new Set(modules.map((m) => m.id));
      const missingModuleIds = Array.from(allModuleIds).filter(
        (id) => !foundModuleIds.has(id),
      );
      throw new BadRequestException(
        `Module IDs not found: ${missingModuleIds.join(", ")}`,
      );
    }

    // Validate all actions exist
    const actions = await this.actionRepository.findBy({
      id: In(Array.from(allActionIds)),
    });
    if (actions.length !== allActionIds.size) {
      const foundActionIds = new Set(actions.map((a) => a.id));
      const missingActionIds = Array.from(allActionIds).filter(
        (id) => !foundActionIds.has(id),
      );
      throw new BadRequestException(
        `Action IDs not found: ${missingActionIds.join(", ")}`,
      );
    }

    // Step 1: Mark all existing action presets for this role within target access keys as inactive
    await queryRunner.manager.update(
      RoleActionPreset,
      { role_id: roleId, access_key_id: In(targetAccessKeyIds) },
      {
        status_id: 2, // inactive
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // Step 2: Upsert action presets
    const savedActionPresets: RoleActionPreset[] = [];
    const moduleMap = new Map(modules.map((m) => [m.id, m]));
    const actionMap = new Map(actions.map((a) => [a.id, a]));
    const createdByUser = await this.userRepository.findOneBy({
      id: updatedBy,
    });

    for (const preset of presets) {
      const moduleId = preset.module_ids;
      const actionIds = preset.action_ids;
      const keysForThisPreset = preset.access_key_id
        ? [preset.access_key_id]
        : targetAccessKeyIds;

      if (!Array.isArray(actionIds) || actionIds.length === 0) {
        logger.warn(
          `action_ids must be a non-empty array for module ${moduleId}, skipping`,
        );
        continue;
      }

      for (const accessKeyId of keysForThisPreset) {
        for (const actionId of actionIds) {
          // Find existing preset regardless of status (to reactivate if needed)
          const existingPreset = await queryRunner.manager.findOne(
            RoleActionPreset,
            {
              where: {
                role_id: roleId,
                module_id: moduleId,
                action_id: actionId,
                access_key_id: accessKeyId,
              },
            },
          );

          if (existingPreset) {
            // Update existing preset with the provided status
            await queryRunner.manager.update(
              RoleActionPreset,
              { id: existingPreset.id },
              {
                status_id: status.id,
                updated_by: updatedBy,
                modified_at: new Date(),
              },
            );

            // Sync in-memory object with database updates
            existingPreset.status_id = status.id;
            existingPreset.updated_by = updatedBy;
            existingPreset.modified_at = new Date();
            savedActionPresets.push(existingPreset);
          } else {
            // Create new preset
            const newActionPreset = new RoleActionPreset();
            newActionPreset.role = role;
            newActionPreset.role_id = roleId;
            newActionPreset.module = moduleMap.get(moduleId)!;
            newActionPreset.module_id = moduleId;
            newActionPreset.action = actionMap.get(actionId)!;
            newActionPreset.action_id = actionId;
            newActionPreset.access_key_id = accessKeyId;
            newActionPreset.status = status;
            newActionPreset.status_id = status.id;
            newActionPreset.createdBy = createdByUser;
            newActionPreset.created_by = updatedBy;
            const saved = await queryRunner.manager.save(
              RoleActionPreset,
              newActionPreset,
            );
            savedActionPresets.push(saved);
          }
        }
      }
    }

    logger.info(
      `Successfully updated ${savedActionPresets.length} role action presets for role_id ${roleId}`,
    );

    return savedActionPresets;
  }

  // Create role preset with complex structure (similar to Express create method)
  async createRolePreset(
    createRolePresetDto: CreateRolePresetDto,
    userId: number,
  ): Promise<any> {
    const {
      role_id,
      location_ids,
      warehouse_ids = [],
      presets,
      status_id,
      user_ids = [],
      apply_permissions_to_users = false,
      apply_locations_to_users = false,
      apply_warehouses_to_users = false,
      apply_permissions_to_users_only = false,
      apply_locations_to_users_only = false,
      apply_warehouses_to_users_only = false,
    } = createRolePresetDto;

    try {
      // Start transaction for consistency
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Validate role exists
        const role = await this.roleRepository.findOneBy({ id: role_id });
        if (!role) {
          throw new BadRequestException(`Role with ID ${role_id} not found.`);
        }

        // Validate status
        const resolvedStatusId = status_id || 1;
        const status = await this.statusRepository.findOneBy({
          id: resolvedStatusId,
        });
        if (!status) {
          throw new BadRequestException(
            `Status with ID ${resolvedStatusId} not found.`,
          );
        }

        // Get authenticated user
        const createdByUser = await this.userRepository.findOneBy({
          id: userId,
        });
        if (!createdByUser) {
          throw new BadRequestException("Authenticated user not found.");
        }

        const targetAccessKeyIds =
          createRolePresetDto.access_key_ids &&
          createRolePresetDto.access_key_ids.length > 0
            ? createRolePresetDto.access_key_ids
            : [1];

        const cascadeTargetAccessKeyIds =
          createRolePresetDto.target_access_key_ids &&
          createRolePresetDto.target_access_key_ids.length > 0
            ? createRolePresetDto.target_access_key_ids
            : targetAccessKeyIds;

        let savedLocationPresets: RoleLocationPreset[] = [];
        let savedWarehousePresets: RoleWarehousePreset[] = [];
        let savedActionPresets: RoleActionPreset[] = [];

        const shouldUpdateRoleLocations = !apply_locations_to_users_only;
        const shouldUpdateRoleWarehouses = !apply_warehouses_to_users_only;
        const shouldUpdateRoleActions = !apply_permissions_to_users_only;

        if (
          createRolePresetDto.tenant_configs &&
          Object.keys(createRolePresetDto.tenant_configs).length > 0
        ) {
          for (const [keyIdStr, configObj] of Object.entries(
            createRolePresetDto.tenant_configs,
          )) {
            const keyId = Number(keyIdStr);
            const config = configObj as {
              location_ids?: number[];
              warehouse_ids?: number[];
              presets?: any[];
            };
            if (shouldUpdateRoleLocations && config.location_ids) {
              const locs = await this.updateRoleLocationPresetsFromPresets(
                role_id,
                config.location_ids,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedLocationPresets.push(...locs);
            }
            if (shouldUpdateRoleWarehouses && config.warehouse_ids) {
              const whs = await this.updateRoleWarehousePresetsFromPresets(
                role_id,
                config.warehouse_ids,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedWarehousePresets.push(...whs);
            }
            if (shouldUpdateRoleActions && config.presets) {
              const acts = await this.updateRoleActionPresetsFromPresets(
                role_id,
                config.presets,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedActionPresets.push(...acts);
            }
          }
        } else {
          if (shouldUpdateRoleLocations) {
            // Update location presets using helper (mark-inactive-then-upsert)
            savedLocationPresets =
              await this.updateRoleLocationPresetsFromPresets(
                role_id,
                location_ids,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }

          if (shouldUpdateRoleWarehouses && warehouse_ids && warehouse_ids.length > 0) {
            // Update warehouse presets using helper (mark-inactive-then-upsert)
            savedWarehousePresets =
              await this.updateRoleWarehousePresetsFromPresets(
                role_id,
                warehouse_ids,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }

          if (shouldUpdateRoleActions) {
            // Update action presets using helper (mark-inactive-then-upsert)
            savedActionPresets =
              await this.updateRoleActionPresetsFromPresets(
                role_id,
                presets,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }
        }

        // Handle user permissions, locations, and warehouses updates if requested
        const shouldCascadePermissions =
          apply_permissions_to_users || apply_permissions_to_users_only;
        const shouldCascadeLocations =
          apply_locations_to_users || apply_locations_to_users_only;
        const shouldCascadeWarehouses =
          apply_warehouses_to_users || apply_warehouses_to_users_only;

        if (user_ids.length > 0 && (shouldCascadePermissions || shouldCascadeLocations || shouldCascadeWarehouses)) {
          const [userPermKeys, userLocKeys, userWhKeys] = await Promise.all([
            this.userPermissionsRepository
              .createQueryBuilder("up")
              .select("DISTINCT up.access_key_id", "access_key_id")
              .where("up.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
            this.userLocationsRepository
              .createQueryBuilder("ul")
              .select("DISTINCT ul.access_key_id", "access_key_id")
              .where("ul.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
            this.userWarehousesRepository
              .createQueryBuilder("uw")
              .select("DISTINCT uw.access_key_id", "access_key_id")
              .where("uw.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
          ]);

          let userKeys = Array.from(
            new Set([
              ...userPermKeys.map((k) => k.access_key_id),
              ...userLocKeys.map((k) => k.access_key_id),
              ...userWhKeys.map((k) => k.access_key_id),
            ]),
          );

          if (userKeys.length === 0) {
            userKeys = cascadeTargetAccessKeyIds;
          }

          const hasTenantConfigs =
            createRolePresetDto.tenant_configs &&
            Object.keys(createRolePresetDto.tenant_configs).length > 0;

          if (shouldCascadePermissions) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                createRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  presets?: any[];
                };
                if (config.presets && userKeys.includes(keyId)) {
                  await this.updateUserPermissions(
                    user_ids,
                    role_id,
                    config.presets,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0) {
                await this.updateUserPermissions(
                  user_ids,
                  role_id,
                  presets,
                  eligibleKeys,
                  userId,
                );
              }
            }
          }

          if (shouldCascadeLocations) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                createRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  presets?: any[];
                };
                if (config.location_ids && userKeys.includes(keyId)) {
                  await this.updateUserLocations(
                    user_ids,
                    role_id,
                    config.location_ids,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0) {
                await this.updateUserLocations(
                  user_ids,
                  role_id,
                  location_ids,
                  eligibleKeys,
                  userId,
                );
              }
            }

            // SSE Events
            try {
              // Option 2: WITHOUT data
              this.sseEventEmitter.emitUpdateSignal("locations", 0);
            } catch (err) {
              console.warn("SSE event failed for update:", err);
            }
          }

          if (shouldCascadeWarehouses) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                createRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  warehouse_ids?: number[];
                  presets?: any[];
                };
                if (config.warehouse_ids && userKeys.includes(keyId)) {
                  await this.updateUserWarehouses(
                    user_ids,
                    role_id,
                    config.warehouse_ids,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0 && warehouse_ids && warehouse_ids.length > 0) {
                await this.updateUserWarehouses(
                  user_ids,
                  role_id,
                  warehouse_ids,
                  eligibleKeys,
                  userId,
                );
              }
            }
          }
        }

        await queryRunner.commitTransaction();

        // Get all modules and actions for response
        const allModuleIds = new Set<number>();
        const allActionIds = new Set<number>();

        presets.forEach((preset) => {
          if (preset.module_ids) {
            allModuleIds.add(preset.module_ids);
          }
          if (Array.isArray(preset.action_ids)) {
            preset.action_ids.forEach((actionId: number) =>
              allActionIds.add(actionId),
            );
          }
        });

        const modules = await this.moduleRepository.findBy({
          id: In(Array.from(allModuleIds)),
        });
        const actions = await this.actionRepository.findBy({
          id: In(Array.from(allActionIds)),
        });
        const locations = await this.locationRepository.findBy({
          id: In(location_ids),
        });

        // Build flattened response
        const moduleNames = modules.map((m) => m.module_name);
        const actionNames = actions.map((a) => a.action_name);
        const locationNames = locations.map((l) => l.location_name);

        const flattenedResponse = {
          id: savedActionPresets[0]?.id || savedLocationPresets[0]?.id,
          role_id: role_id,
          module_id: savedActionPresets[0]?.module_id || null,
          action_id: savedActionPresets[0]?.action_id || null,
          status_id: resolvedStatusId,
          created_at: new Date(),
          created_by: userId,
          updated_by: null,
          modified_at: new Date(),
          role_name: role.role_name,
          module_name: moduleNames,
          action_name: actionNames,
          location_name: locationNames,
          status_name: status.status_name,
          created_user: `${createdByUser.first_name} ${createdByUser.last_name}`,
          updated_user: null,
        };

        // Audit trail
        await this.userAuditTrailCreateService.create(
          {
            service: "RoleActionPresetsService",
            method: "createRolePreset",
            raw_data: JSON.stringify({
              role_id,
              location_ids,
              presets,
              status_id: resolvedStatusId,
              user_ids,
              apply_permissions_to_users,
              apply_locations_to_users,
              created_by: userId,
              created_at: new Date(),
            }),
            description: `Created role action presets for role ${role_id}`,
            status_id: 1,
          },
          userId,
        );

        logger.info(
          `Successfully created ${savedLocationPresets.length} location presets and ${savedActionPresets.length} action presets for role ${role_id} by user ${userId}`,
        );

        // SSE Events
        try {
          // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
          const userIds =
            await this.usersService.getUserPermissionsByRole(role_id);
          userIds.forEach((uid) => {
            this.sseEventEmitter.emitUpdateSignal("users", uid);
          });
          this.sseEventEmitter.emitCreateSignal("role_presets", role_id);
          this.sseEventEmitter.emitUpdateSignal("roles", role_id);
          await this.cacheInvalidationService.invalidateFindAll("users");
        } catch (err) {
          console.warn("SSE event failed for update:", err);
        }

        return flattenedResponse;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error("Error creating role presets:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to create role presets.");
    }
  }

  // Update role preset with complex structure (similar to Express update method)
  async updateRolePreset(
    role_id: number,
    updateRolePresetDto: UpdateRolePresetDto,
    userId: number,
  ): Promise<any> {
    const {
      location_ids,
      warehouse_ids = [],
      presets,
      status_id,
      user_ids = [],
      apply_permissions_to_users = false,
      apply_locations_to_users = false,
      apply_warehouses_to_users = false,
      apply_permissions_to_users_only = false,
      apply_locations_to_users_only = false,
      apply_warehouses_to_users_only = false,
    } = updateRolePresetDto;

    // console.log("UpdateRolePresetDto:", updateRolePresetDto);

    try {
      // Start transaction for consistency
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Validate role exists
        const role = await this.roleRepository.findOneBy({ id: role_id });
        if (!role) {
          throw new NotFoundException(`Role with ID ${role_id} not found.`);
        }

        // Validate status
        const resolvedStatusId = status_id || 1;
        const status = await this.statusRepository.findOneBy({
          id: resolvedStatusId,
        });
        if (!status) {
          throw new BadRequestException(
            `Status with ID ${resolvedStatusId} not found.`,
          );
        }

        // Get authenticated user
        const updatedByUser = await this.userRepository.findOneBy({
          id: userId,
        });
        if (!updatedByUser) {
          throw new BadRequestException("Authenticated user not found.");
        }

        const targetAccessKeyIds =
          updateRolePresetDto.access_key_ids &&
          updateRolePresetDto.access_key_ids.length > 0
            ? updateRolePresetDto.access_key_ids
            : [1];

        const cascadeTargetAccessKeyIds =
          updateRolePresetDto.target_access_key_ids &&
          updateRolePresetDto.target_access_key_ids.length > 0
            ? updateRolePresetDto.target_access_key_ids
            : targetAccessKeyIds;

        let savedLocationPresets: RoleLocationPreset[] = [];
        let savedWarehousePresets: RoleWarehousePreset[] = [];
        let savedActionPresets: RoleActionPreset[] = [];

        const shouldUpdateRoleLocations = !apply_locations_to_users_only;
        const shouldUpdateRoleWarehouses = !apply_warehouses_to_users_only;
        const shouldUpdateRoleActions = !apply_permissions_to_users_only;

        if (
          updateRolePresetDto.tenant_configs &&
          Object.keys(updateRolePresetDto.tenant_configs).length > 0
        ) {
          for (const [keyIdStr, configObj] of Object.entries(
            updateRolePresetDto.tenant_configs,
          )) {
            const keyId = Number(keyIdStr);
            const config = configObj as {
              location_ids?: number[];
              warehouse_ids?: number[];
              presets?: any[];
            };
            if (shouldUpdateRoleLocations && config.location_ids) {
              const locs = await this.updateRoleLocationPresetsFromPresets(
                role_id,
                config.location_ids,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedLocationPresets.push(...locs);
            }
            if (shouldUpdateRoleWarehouses && config.warehouse_ids) {
              const whs = await this.updateRoleWarehousePresetsFromPresets(
                role_id,
                config.warehouse_ids,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedWarehousePresets.push(...whs);
            }
            if (shouldUpdateRoleActions && config.presets) {
              const acts = await this.updateRoleActionPresetsFromPresets(
                role_id,
                config.presets,
                status,
                userId,
                queryRunner,
                [keyId],
              );
              savedActionPresets.push(...acts);
            }
          }
        } else {
          if (shouldUpdateRoleLocations) {
            // Update location presets using helper (mark-inactive-then-upsert)
            savedLocationPresets =
              await this.updateRoleLocationPresetsFromPresets(
                role_id,
                location_ids,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }

          if (shouldUpdateRoleWarehouses && warehouse_ids && warehouse_ids.length > 0) {
            // Update warehouse presets using helper (mark-inactive-then-upsert)
            savedWarehousePresets =
              await this.updateRoleWarehousePresetsFromPresets(
                role_id,
                warehouse_ids,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }

          if (shouldUpdateRoleActions) {
            // Update action presets using helper (mark-inactive-then-upsert)
            savedActionPresets =
              await this.updateRoleActionPresetsFromPresets(
                role_id,
                presets,
                status,
                userId,
                queryRunner,
                targetAccessKeyIds,
              );
          }
        }

        // Handle user permissions, locations, and warehouses updates if requested
        const shouldCascadePermissions =
          apply_permissions_to_users || apply_permissions_to_users_only;
        const shouldCascadeLocations =
          apply_locations_to_users || apply_locations_to_users_only;
        const shouldCascadeWarehouses =
          apply_warehouses_to_users || apply_warehouses_to_users_only;

        if (user_ids.length > 0 && (shouldCascadePermissions || shouldCascadeLocations || shouldCascadeWarehouses)) {
          const [userPermKeys, userLocKeys, userWhKeys] = await Promise.all([
            this.userPermissionsRepository
              .createQueryBuilder("up")
              .select("DISTINCT up.access_key_id", "access_key_id")
              .where("up.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
            this.userLocationsRepository
              .createQueryBuilder("ul")
              .select("DISTINCT ul.access_key_id", "access_key_id")
              .where("ul.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
            this.userWarehousesRepository
              .createQueryBuilder("uw")
              .select("DISTINCT uw.access_key_id", "access_key_id")
              .where("uw.user_id IN (:...userIds)", { userIds: user_ids })
              .getRawMany(),
          ]);

          let userKeys = Array.from(
            new Set([
              ...userPermKeys.map((k) => k.access_key_id),
              ...userLocKeys.map((k) => k.access_key_id),
              ...userWhKeys.map((k) => k.access_key_id),
            ]),
          );

          if (userKeys.length === 0) {
            userKeys = cascadeTargetAccessKeyIds;
          }

          const hasTenantConfigs =
            updateRolePresetDto.tenant_configs &&
            Object.keys(updateRolePresetDto.tenant_configs).length > 0;

          if (shouldCascadePermissions) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                updateRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  presets?: any[];
                };
                if (config.presets && userKeys.includes(keyId)) {
                  await this.updateUserPermissions(
                    user_ids,
                    role_id,
                    config.presets,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0) {
                await this.updateUserPermissions(
                  user_ids,
                  role_id,
                  presets,
                  eligibleKeys,
                  userId,
                );
              }
            }
          }

          if (shouldCascadeLocations) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                updateRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  presets?: any[];
                };
                if (config.location_ids && userKeys.includes(keyId)) {
                  await this.updateUserLocations(
                    user_ids,
                    role_id,
                    config.location_ids,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0) {
                await this.updateUserLocations(
                  user_ids,
                  role_id,
                  location_ids,
                  eligibleKeys,
                  userId,
                );
              }
            }
          }

          if (shouldCascadeWarehouses) {
            if (hasTenantConfigs) {
              for (const [keyIdStr, configObj] of Object.entries(
                updateRolePresetDto.tenant_configs!,
              )) {
                const keyId = Number(keyIdStr);
                if (!cascadeTargetAccessKeyIds.includes(keyId)) {
                  continue;
                }
                const config = configObj as {
                  location_ids?: number[];
                  warehouse_ids?: number[];
                  presets?: any[];
                };
                if (config.warehouse_ids && userKeys.includes(keyId)) {
                  await this.updateUserWarehouses(
                    user_ids,
                    role_id,
                    config.warehouse_ids,
                    [keyId],
                    userId,
                  );
                }
              }
            } else {
              const eligibleKeys = cascadeTargetAccessKeyIds.filter((k) =>
                userKeys.includes(k),
              );

              if (eligibleKeys.length > 0 && warehouse_ids && warehouse_ids.length > 0) {
                await this.updateUserWarehouses(
                  user_ids,
                  role_id,
                  warehouse_ids,
                  eligibleKeys,
                  userId,
                );
              }
            }
          }
        }

        await queryRunner.commitTransaction();

        // Get all modules and actions for response
        const allModuleIds = new Set<number>();
        const allActionIds = new Set<number>();

        presets.forEach((preset) => {
          if (preset.module_ids) {
            allModuleIds.add(preset.module_ids);
          }
          if (Array.isArray(preset.action_ids)) {
            preset.action_ids.forEach((actionId: number) =>
              allActionIds.add(actionId),
            );
          }
        });

        const modules = await this.moduleRepository.findBy({
          id: In(Array.from(allModuleIds)),
        });
        const actions = await this.actionRepository.findBy({
          id: In(Array.from(allActionIds)),
        });
        const locations = await this.locationRepository.findBy({
          id: In(location_ids),
        });

        // Build flattened response
        const moduleNames = modules.map((m) => m.module_name);
        const actionNames = actions.map((a) => a.action_name);
        const locationNames = locations.map((l) => l.location_name);

        const flattenedResponse = {
          id: savedActionPresets[0]?.id || savedLocationPresets[0]?.id,
          role_id: role_id,
          module_id: savedActionPresets[0]?.module_id || null,
          action_id: savedActionPresets[0]?.action_id || null,
          status_id: resolvedStatusId,
          created_at:
            savedActionPresets[0]?.created_at ||
            savedLocationPresets[0]?.created_at,
          created_by:
            savedActionPresets[0]?.created_by ||
            savedLocationPresets[0]?.created_by,
          updated_by: userId,
          modified_at: new Date(),
          role_name: role.role_name,
          module_name: moduleNames,
          action_name: actionNames,
          location_name: locationNames,
          status_name: status.status_name,
          created_user: savedActionPresets[0]?.createdBy
            ? `${savedActionPresets[0].createdBy.first_name} ${savedActionPresets[0].createdBy.last_name}`
            : `${savedLocationPresets[0]?.createdBy?.first_name} ${savedLocationPresets[0]?.createdBy?.last_name}`,
          updated_user: `${updatedByUser.first_name} ${updatedByUser.last_name}`,
        };

        // Audit trail
        await this.userAuditTrailCreateService.create(
          {
            service: "RoleActionPresetsService",
            method: "updateRolePreset",
            raw_data: JSON.stringify({
              role_id,
              location_ids,
              presets,
              status_id: resolvedStatusId,
              user_ids,
              apply_permissions_to_users,
              apply_locations_to_users,
              updated_by: userId,
              updated_at: new Date(),
              savedLocationPresets: savedLocationPresets.map((lp) => ({
                id: lp.id,
                location_id: lp.location_id,
                status_id: lp.status_id,
                created_by: lp.created_by,
                created_at: lp.created_at,
              })),
              savedActionPresets: savedActionPresets.map((ap) => ({
                id: ap.id,
                module_id: ap.module_id,
                action_id: ap.action_id,
                status_id: ap.status_id,
                created_by: ap.created_by,
                created_at: ap.created_at,
              })),
            }),
            description: `Updated role action presets for role ${role_id}`,
            status_id: 1,
          },
          userId,
        );

        logger.info(
          `Successfully updated ${savedLocationPresets.length} location presets and ${savedActionPresets.length} action presets for role ${role_id} by user ${userId}`,
        );

        // SSE Events
        try {
          // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
          const userIds =
            await this.usersService.getUserPermissionsByRole(role_id);
          userIds.forEach((uid) => {
            this.sseEventEmitter.emitUpdateSignal("users", uid);
          });
          this.sseEventEmitter.emitUpdateSignal("users", 0);
          this.sseEventEmitter.emitUpdateSignal("locations", 0);
          this.sseEventEmitter.emitUpdateSignal("role_presets", role_id);
          this.sseEventEmitter.emitUpdateSignal("roles", role_id);
          await this.cacheInvalidationService.invalidateFindAll("users");
        } catch (err) {
          console.warn("SSE event failed for update:", err);
        }

        return flattenedResponse;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      logger.error(`Error updating role presets for role ${role_id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update role presets for role ${role_id}.`,
      );
    }
  }

  // Helper method to update user permissions for multiple users with batch optimization
  private async updateUserPermissions(
    userIds: number[],
    roleId: number,
    presets: any[],
    accessKeyIds: number[],
    updatedBy: number,
  ): Promise<void> {
    if (!userIds.length || !presets.length || !accessKeyIds.length) return;

    // 1. Mark existing permissions for all target users, role, and access keys as inactive in 1 fast query
    await this.userPermissionsRepository.update(
      {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
      {
        status_id: 2,
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // 2. Fetch existing permissions for this cohort in 1 query
    const existing = await this.userPermissionsRepository.find({
      where: {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
    });

    const permMap = new Map<string, UserPermissions>();
    existing.forEach((p) => {
      permMap.set(
        `${p.user_id}_${p.role_id}_${p.access_key_id}_${p.module_id}_${p.action_id}`,
        p,
      );
    });

    // 3. Fast in-memory reconciliation
    const toSave: UserPermissions[] = [];
    const seen = new Set<string>();

    for (const userId of userIds) {
      for (const accessKeyId of accessKeyIds) {
        for (const preset of presets) {
          const moduleId = preset.module_ids;
          const actionIds = Array.isArray(preset.action_ids)
            ? preset.action_ids
            : [];

          for (const actionId of actionIds) {
            const key = `${userId}_${roleId}_${accessKeyId}_${moduleId}_${actionId}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const existingPerm = permMap.get(key);
            if (existingPerm) {
              existingPerm.status_id = 1;
              existingPerm.updated_by = updatedBy;
              existingPerm.modified_at = new Date();
              toSave.push(existingPerm);
            } else {
              const newPerm = this.userPermissionsRepository.create({
                user_id: userId,
                role_id: roleId,
                module_id: moduleId,
                action_id: actionId,
                access_key_id: accessKeyId,
                status_id: 1,
                created_by: updatedBy,
              });
              toSave.push(newPerm);
            }
          }
        }
      }
    }

    // 4. Batch save in chunks of 500 for optimal database performance
    if (toSave.length > 0) {
      await this.userPermissionsRepository.save(toSave, { chunk: 500 });
    }
  }

  // Helper method to update user locations for multiple users with batch optimization
  private async updateUserLocations(
    userIds: number[],
    roleId: number,
    locationIds: number[],
    accessKeyIds: number[],
    updatedBy: number,
  ): Promise<void> {
    if (!userIds.length || !locationIds.length || !accessKeyIds.length) return;

    // 1. Mark existing locations for all target users, role, and access keys as inactive in 1 fast query
    await this.userLocationsRepository.update(
      {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
      {
        status_id: 2,
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // 2. Fetch existing locations for this cohort in 1 query
    const existing = await this.userLocationsRepository.find({
      where: {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
    });

    const locMap = new Map<string, UserLocations>();
    existing.forEach((l) => {
      locMap.set(
        `${l.user_id}_${l.role_id}_${l.access_key_id}_${l.location_id}`,
        l,
      );
    });

    // 3. Fast in-memory reconciliation
    const toSave: UserLocations[] = [];
    const seen = new Set<string>();

    for (const userId of userIds) {
      for (const accessKeyId of accessKeyIds) {
        for (const locationId of locationIds) {
          const key = `${userId}_${roleId}_${accessKeyId}_${locationId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const existingLoc = locMap.get(key);
          if (existingLoc) {
            existingLoc.status_id = 1;
            existingLoc.updated_by = updatedBy;
            existingLoc.modified_at = new Date();
            toSave.push(existingLoc);
          } else {
            const newLoc = this.userLocationsRepository.create({
              user_id: userId,
              role_id: roleId,
              location_id: locationId,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: updatedBy,
            });
            toSave.push(newLoc);
          }
        }
      }
    }

    // 4. Batch save in chunks of 500 for optimal database performance
    if (toSave.length > 0) {
      await this.userLocationsRepository.save(toSave, { chunk: 500 });
    }
  }

  // Helper method to update user warehouses for multiple users with batch optimization
  private async updateUserWarehouses(
    userIds: number[],
    roleId: number,
    warehouseIds: number[],
    accessKeyIds: number[],
    updatedBy: number,
  ): Promise<void> {
    if (!userIds.length || !warehouseIds.length || !accessKeyIds.length) return;

    // 1. Mark existing warehouses for all target users, role, and access keys as inactive in 1 fast query
    await this.userWarehousesRepository.update(
      {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
      {
        status_id: 2, // inactive (NO DELETE!)
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // 2. Fetch existing warehouses for this cohort in 1 query
    const existing = await this.userWarehousesRepository.find({
      where: {
        user_id: In(userIds),
        role_id: roleId,
        access_key_id: In(accessKeyIds),
      },
    });

    const whMap = new Map<string, UserWarehouses>();
    existing.forEach((w) => {
      whMap.set(
        `${w.user_id}_${w.role_id}_${w.access_key_id}_${w.warehouse_id}`,
        w,
      );
    });

    // 3. Fast in-memory reconciliation
    const toSave: UserWarehouses[] = [];
    const seen = new Set<string>();

    for (const userId of userIds) {
      for (const accessKeyId of accessKeyIds) {
        for (const warehouseId of warehouseIds) {
          const key = `${userId}_${roleId}_${accessKeyId}_${warehouseId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const existingWh = whMap.get(key);
          if (existingWh) {
            existingWh.status_id = 1;
            existingWh.updated_by = updatedBy;
            existingWh.modified_at = new Date();
            toSave.push(existingWh);
          } else {
            const newWh = this.userWarehousesRepository.create({
              user_id: userId,
              role_id: roleId,
              warehouse_id: warehouseId,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: updatedBy,
            });
            toSave.push(newWh);
          }
        }
      }
    }

    // 4. Batch save in chunks of 500 for optimal database performance
    if (toSave.length > 0) {
      await this.userWarehousesRepository.save(toSave, { chunk: 500 });
    }
  }
}
