import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { RoleLocationPreset } from "../../../entities/RoleLocationPreset";
import { Role } from "../../../entities/Role";
import { Location } from "../../../entities/Location";
import { Status } from "../../../entities/Status";
import { User } from "../../../entities/User";
import { UpdateRoleLocationPresetDto } from "src/modules/roles/dto/UpdateRoleLocationPresetDto";
import { CreateRoleLocationPresetDto } from "src/modules/roles/dto/CreateRoleLocationPresetDto";
import logger from "src/config/logger";

@Injectable()
export class RoleLocationPresetsService {
  constructor(
    @InjectRepository(RoleLocationPreset)
    private roleLocationPresetRepository: Repository<RoleLocationPreset>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll() {
    const roleLocationPresets = await this.roleLocationPresetRepository.find({
      relations: ["role", "location", "status", "createdBy", "updatedBy"],
    });

    return roleLocationPresets.map((preset) => ({
      id: preset.id,
      role_id: preset.role_id,
      role_name: preset.role ? preset.role.role_name : null,
      location_id: preset.location_id,
      location_name: preset.location ? preset.location.location_name : null,
      status_id: preset.status_id,
      created_at: preset.created_at,
      created_by: preset.created_by,
      updated_by: preset.updated_by || null,
      modified_at: preset.modified_at,
      created_user: preset.createdBy
        ? `${preset.createdBy.first_name} ${preset.createdBy.last_name}`
        : null,
      updated_user: preset.updatedBy
        ? `${preset.updatedBy.first_name} ${preset.updatedBy.last_name}`
        : null,
      status_name: preset.status ? preset.status.status_name : null,
    }));
  }

  async findOne(id: number) {
    const roleLocationPreset = await this.roleLocationPresetRepository.findOne({
      where: { id },
      relations: ["role", "location", "status", "createdBy", "updatedBy"],
    });

    if (!roleLocationPreset) {
      throw new NotFoundException(
        `Role location preset with ID ${id} not found`,
      );
    }

    return {
      id: roleLocationPreset.id,
      role_id: roleLocationPreset.role_id,
      role_name: roleLocationPreset.role
        ? roleLocationPreset.role.role_name
        : null,
      location_id: roleLocationPreset.location_id,
      location_name: roleLocationPreset.location
        ? roleLocationPreset.location.location_name
        : null,
      status_id: roleLocationPreset.status_id,
      created_at: roleLocationPreset.created_at,
      created_by: roleLocationPreset.created_by,
      updated_by: roleLocationPreset.updated_by || null,
      modified_at: roleLocationPreset.modified_at,
      created_user: roleLocationPreset.createdBy
        ? `${roleLocationPreset.createdBy.first_name} ${roleLocationPreset.createdBy.last_name}`
        : null,
      updated_user: roleLocationPreset.updatedBy
        ? `${roleLocationPreset.updatedBy.first_name} ${roleLocationPreset.updatedBy.last_name}`
        : null,
      status_name: roleLocationPreset.status
        ? roleLocationPreset.status.status_name
        : null,
    };
  }

  async create(
    createRoleLocationPresetDto: CreateRoleLocationPresetDto,
    userId: number,
  ) {
    const {
      role_id,
      location_ids,
      status_id = 1,
    } = createRoleLocationPresetDto;
    const authenticatedUserId = userId;
    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        "Authenticated user ID is required to create role location presets.",
      );
    }

    try {
      // Fetch common related entities once
      const role = await this.roleRepository.findOneBy({ id: role_id });
      if (!role) {
        logger.warn(`Role with ID ${role_id} not found for preset creation.`);
        throw new BadRequestException(`Role with ID ${role_id} not found.`);
      }

      const resolvedStatusId = status_id || 1;
      const status = await this.statusRepository.findOneBy({
        id: resolvedStatusId,
      });
      if (!status) {
        logger.warn(
          `Status with ID ${resolvedStatusId} not found for preset creation.`,
        );
        throw new BadRequestException(
          `Status with ID ${resolvedStatusId} not found.`,
        );
      }

      // MODIFIED: Use UserService to get the createdBy user (without password)
      const createdByUser = await this.userRepository.findOneBy({
        id: authenticatedUserId,
      });
      if (!createdByUser) {
        logger.error(
          `Authenticated user (ID: ${authenticatedUserId}) not found via repository for creating role location preset.`,
        );
        throw new BadRequestException("Authenticated user not found.");
      }

      // Fetch all locations efficiently
      const locations = await this.locationRepository.findBy({
        id: In(location_ids),
      });
      if (locations.length !== location_ids.length) {
        const foundLocationIds = new Set(locations.map((l) => l.id));
        const missingLocationIds = location_ids.filter(
          (id: number) => !foundLocationIds.has(id),
        );
        logger.warn(
          `Missing location IDs for preset creation: ${missingLocationIds.join(
            ", ",
          )}`,
        );
        throw new BadRequestException(
          `One or more location IDs not found: ${missingLocationIds.join(", ")}`,
        );
      }
      const locationMap = new Map(locations.map((l) => [l.id, l]));

      const newPresetsToSave: RoleLocationPreset[] = [];
      const existingCombinations = new Set<string>();

      // Check existing presets first to prevent unnecessary database calls in the loop
      const currentPresets = await this.roleLocationPresetRepository.find({
        where: {
          role_id: role_id,
          location_id: In(location_ids),
        },
      });
      currentPresets.forEach((p) =>
        existingCombinations.add(`${p.role_id}-${p.location_id}`),
      );

      for (const locationId of location_ids) {
        const combinationKey = `${role_id}-${locationId}`;
        if (existingCombinations.has(combinationKey)) {
          logger.warn(
            `Skipping duplicate role location preset: Role ID ${role_id}, Location ID ${locationId}`,
          );
          continue; // Skip creating this duplicate
        }

        const preset = new RoleLocationPreset();
        preset.role = role;
        preset.role_id = role.id;
        preset.location = locationMap.get(locationId)!;
        preset.location_id = locationId;
        preset.status = status;
        preset.status_id = status.id;
        preset.createdBy = createdByUser;
        preset.created_by = createdByUser.id;

        newPresetsToSave.push(preset);
        existingCombinations.add(combinationKey); // Add to local set to prevent duplicates within the batch
      }

      if (newPresetsToSave.length === 0) {
        if (location_ids.length > 0) {
          throw new BadRequestException(
            "All provided role-location combinations already exist or are invalid.",
          );
        } else {
          throw new BadRequestException(
            "No valid combinations to create from provided input.",
          );
        }
      }

      const savedPresets =
        await this.roleLocationPresetRepository.save(newPresetsToSave);

      const result = {
        message: `Successfully created ${savedPresets.length} new role location preset(s).`,
        createdPresets: savedPresets,
      };
      logger.info(
        `Successfully created ${savedPresets.length} new role location preset(s) by user ${authenticatedUserId}`,
      );
      return result;
    } catch (error) {
      logger.error("Error creating role location preset:", error);
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new Error("Failed to create role location preset.");
    }
  }

  async update(
    id: number,
    updateRoleLocationPresetDto: UpdateRoleLocationPresetDto,
    userId: number,
  ) {
    const { role_id, location_id, status_id } = updateRoleLocationPresetDto;

    const roleLocationPresetToUpdate =
      await this.roleLocationPresetRepository.findOne({
        where: { id },
        relations: ["role", "location", "status", "createdBy", "updatedBy"],
      });

    if (!roleLocationPresetToUpdate) {
      throw new NotFoundException("Role location preset not found for update.");
    }

    // Validate entities if provided
    if (role_id !== undefined) {
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${role_id} not found`);
      }
      roleLocationPresetToUpdate.role = role;
      roleLocationPresetToUpdate.role_id = role.id;
    }

    if (location_id !== undefined) {
      const location = await this.locationRepository.findOne({
        where: { id: location_id },
      });
      if (!location) {
        throw new BadRequestException(
          `Location with ID ${location_id} not found`,
        );
      }
      roleLocationPresetToUpdate.location = location;
      roleLocationPresetToUpdate.location_id = location.id;
    }

    if (status_id !== undefined) {
      const statusEntity = await this.statusRepository.findOneBy({
        id: status_id,
      });
      if (!statusEntity) {
        throw new BadRequestException(`Status with ID ${status_id} not found.`);
      }
      roleLocationPresetToUpdate.status = statusEntity;
      roleLocationPresetToUpdate.status_id = statusEntity.id;
    }

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    roleLocationPresetToUpdate.updatedBy = updatedByUser;
    roleLocationPresetToUpdate.updated_by = updatedByUser.id;

    const savedRoleLocationPreset =
      await this.roleLocationPresetRepository.save(roleLocationPresetToUpdate);

    // Fetch complete data with relations
    const updatedRoleLocationPreset =
      await this.roleLocationPresetRepository.findOne({
        where: { id: savedRoleLocationPreset.id },
        relations: ["role", "location", "status", "createdBy", "updatedBy"],
      });

    if (!updatedRoleLocationPreset) {
      throw new Error("Failed to retrieve updated role location preset");
    }

    return {
      id: updatedRoleLocationPreset.id,
      role_id: updatedRoleLocationPreset.role_id,
      role_name: updatedRoleLocationPreset.role
        ? updatedRoleLocationPreset.role.role_name
        : null,
      location_id: updatedRoleLocationPreset.location_id,
      location_name: updatedRoleLocationPreset.location
        ? updatedRoleLocationPreset.location.location_name
        : null,
      status_id: updatedRoleLocationPreset.status_id,
      created_at: updatedRoleLocationPreset.created_at,
      created_by: updatedRoleLocationPreset.created_by,
      updated_by: updatedRoleLocationPreset.updated_by || null,
      modified_at: updatedRoleLocationPreset.modified_at,
      created_user: updatedRoleLocationPreset.createdBy
        ? `${updatedRoleLocationPreset.createdBy.first_name} ${updatedRoleLocationPreset.createdBy.last_name}`
        : null,
      updated_user: updatedRoleLocationPreset.updatedBy
        ? `${updatedRoleLocationPreset.updatedBy.first_name} ${updatedRoleLocationPreset.updatedBy.last_name}`
        : null,
      status_name: updatedRoleLocationPreset.status
        ? updatedRoleLocationPreset.status.status_name
        : null,
    };
  }

  async remove(id: number) {
    const roleLocationPresetToRemove =
      await this.roleLocationPresetRepository.findOneBy({ id });

    if (!roleLocationPresetToRemove) {
      throw new NotFoundException(
        "Role location preset not found for deletion.",
      );
    }

    await this.roleLocationPresetRepository.remove(roleLocationPresetToRemove);
    return { message: "Role location preset successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const roleLocationPresetToUpdate =
      await this.roleLocationPresetRepository.findOne({
        where: { id },
        relations: ["role", "location", "status", "createdBy", "updatedBy"],
      });

    if (!roleLocationPresetToUpdate) {
      throw new NotFoundException(
        "Role location preset not found for status toggle.",
      );
    }

    // Determine new status_id
    let newStatusId: number;
    if (roleLocationPresetToUpdate.status_id === 1) {
      newStatusId = 2; // Set to inactive
    } else if (roleLocationPresetToUpdate.status_id === 2) {
      newStatusId = 1; // Set to active
    } else {
      newStatusId = 2; // Default to inactive
    }

    const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });
    if (!newStatusEntity) {
      throw new Error(
        "Target status (active/inactive) not found in the database.",
      );
    }

    roleLocationPresetToUpdate.status = newStatusEntity;
    roleLocationPresetToUpdate.status_id = newStatusEntity.id;

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    roleLocationPresetToUpdate.updatedBy = updatedByUser;
    roleLocationPresetToUpdate.updated_by = updatedByUser.id;

    const updatedRoleLocationPreset =
      await this.roleLocationPresetRepository.save(roleLocationPresetToUpdate);

    const flattenedRoleLocationPreset = {
      id: updatedRoleLocationPreset.id,
      role_id: updatedRoleLocationPreset.role_id,
      role_name: updatedRoleLocationPreset.role
        ? updatedRoleLocationPreset.role.role_name
        : null,
      location_id: updatedRoleLocationPreset.location_id,
      location_name: updatedRoleLocationPreset.location
        ? updatedRoleLocationPreset.location.location_name
        : null,
      status_id: updatedRoleLocationPreset.status_id,
      created_at: updatedRoleLocationPreset.created_at,
      created_by: updatedRoleLocationPreset.created_by,
      updated_by: updatedRoleLocationPreset.updated_by || null,
      modified_at: updatedRoleLocationPreset.modified_at,
      created_user: updatedRoleLocationPreset.createdBy
        ? `${updatedRoleLocationPreset.createdBy.first_name} ${updatedRoleLocationPreset.createdBy.last_name}`
        : null,
      updated_user: updatedRoleLocationPreset.updatedBy
        ? `${updatedRoleLocationPreset.updatedBy.first_name} ${updatedRoleLocationPreset.updatedBy.last_name}`
        : null,
      status_name: updatedRoleLocationPreset.status
        ? updatedRoleLocationPreset.status.status_name
        : null,
    };

    return {
      message: `Role location preset status successfully toggled to ${newStatusEntity.status_name}.`,
      role_location_preset: flattenedRoleLocationPreset,
    };
  }
}
