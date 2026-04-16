import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPermissions } from "../../../entities/UserPermissions";
import { User } from "../../../entities/User";
import { Role } from "../../../entities/Role";
import { Module } from "../../../entities/Module";
import { Action } from "../../../entities/Action";
import { AccessKey } from "../../../entities/AccessKey";
import { Status } from "../../../entities/Status";

@Injectable()
export class UserPermissionsService {
  constructor(
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  async findAll() {
    const userPermissions = await this.userPermissionsRepository.find({
      relations: [
        "user",
        "role",
        "module",
        "action",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    return userPermissions.map((userPermission) => ({
      id: userPermission.id,
      user_id: userPermission.user_id,
      user_full_name: userPermission.user
        ? `${userPermission.user.first_name} ${userPermission.user.last_name}`
        : null,
      role_id: userPermission.role_id,
      role_name: userPermission.role ? userPermission.role.role_name : null,
      module_id: userPermission.module_id,
      module_name: userPermission.module
        ? userPermission.module.module_name
        : null,
      action_id: userPermission.action_id,
      action_name: userPermission.action
        ? userPermission.action.action_name
        : null,
      access_key_id: userPermission.access_key_id,
      access_key_name: userPermission.accessKey
        ? userPermission.accessKey.access_key_name
        : null,
      status_id: userPermission.status_id,
      created_at: userPermission.created_at,
      created_by: userPermission.created_by,
      updated_by: userPermission.updated_by || null,
      modified_at: userPermission.modified_at,
      created_user: userPermission.createdBy
        ? `${userPermission.createdBy.first_name} ${userPermission.createdBy.last_name}`
        : null,
      updated_user: userPermission.updatedBy
        ? `${userPermission.updatedBy.first_name} ${userPermission.updatedBy.last_name}`
        : null,
      status_name: userPermission.status
        ? userPermission.status.status_name
        : null,
    }));
  }

  async findOne(id: number) {
    const userPermission = await this.userPermissionsRepository.findOne({
      where: { id },
      relations: [
        "user",
        "role",
        "module",
        "action",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!userPermission) {
      throw new NotFoundException(`User permission with ID ${id} not found`);
    }

    return {
      id: userPermission.id,
      user_id: userPermission.user_id,
      user_full_name: userPermission.user
        ? `${userPermission.user.first_name} ${userPermission.user.last_name}`
        : null,
      role_id: userPermission.role_id,
      role_name: userPermission.role ? userPermission.role.role_name : null,
      module_id: userPermission.module_id,
      module_name: userPermission.module
        ? userPermission.module.module_name
        : null,
      action_id: userPermission.action_id,
      action_name: userPermission.action
        ? userPermission.action.action_name
        : null,
      access_key_id: userPermission.access_key_id,
      access_key_name: userPermission.accessKey
        ? userPermission.accessKey.access_key_name
        : null,
      status_id: userPermission.status_id,
      created_at: userPermission.created_at,
      created_by: userPermission.created_by,
      updated_by: userPermission.updated_by || null,
      modified_at: userPermission.modified_at,
      created_user: userPermission.createdBy
        ? `${userPermission.createdBy.first_name} ${userPermission.createdBy.last_name}`
        : null,
      updated_user: userPermission.updatedBy
        ? `${userPermission.updatedBy.first_name} ${userPermission.updatedBy.last_name}`
        : null,
      status_name: userPermission.status
        ? userPermission.status.status_name
        : null,
    };
  }

  async create(createUserPermissionsDto: any, userId: number) {
    const {
      user_id,
      role_id,
      module_id,
      action_id,
      access_key_id,
      status_id = 1,
    } = createUserPermissionsDto;

    // Validate all entities exist
    const user = await this.userRepository.findOne({ where: { id: user_id } });
    if (!user) {
      throw new BadRequestException(`User with ID ${user_id} not found`);
    }

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

    const accessKey = await this.accessKeyRepository.findOne({
      where: { id: access_key_id },
    });
    if (!accessKey) {
      throw new BadRequestException(
        `Access key with ID ${access_key_id} not found`,
      );
    }

    // Check if this combination already exists
    const existingPermission = await this.userPermissionsRepository.findOne({
      where: { user_id, role_id, module_id, action_id, access_key_id },
    });
    if (existingPermission) {
      throw new BadRequestException(
        "User permission with this combination already exists.",
      );
    }

    const userPermission = this.userPermissionsRepository.create({
      user_id,
      role_id,
      module_id,
      action_id,
      access_key_id,
      status_id,
      created_by: userId,
    });

    const savedUserPermission =
      await this.userPermissionsRepository.save(userPermission);

    // Fetch complete data with relations
    const newUserPermission = await this.userPermissionsRepository.findOne({
      where: { id: savedUserPermission.id },
      relations: [
        "user",
        "role",
        "module",
        "action",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!newUserPermission) {
      throw new Error("Failed to retrieve created user permission");
    }

    return {
      id: newUserPermission.id,
      user_id: newUserPermission.user_id,
      user_full_name: newUserPermission.user
        ? `${newUserPermission.user.first_name} ${newUserPermission.user.last_name}`
        : null,
      role_id: newUserPermission.role_id,
      role_name: newUserPermission.role
        ? newUserPermission.role.role_name
        : null,
      module_id: newUserPermission.module_id,
      module_name: newUserPermission.module
        ? newUserPermission.module.module_name
        : null,
      action_id: newUserPermission.action_id,
      action_name: newUserPermission.action
        ? newUserPermission.action.action_name
        : null,
      access_key_id: newUserPermission.access_key_id,
      access_key_name: newUserPermission.accessKey
        ? newUserPermission.accessKey.access_key_name
        : null,
      status_id: newUserPermission.status_id,
      created_at: newUserPermission.created_at,
      created_by: newUserPermission.created_by,
      updated_by: newUserPermission.updated_by || null,
      modified_at: newUserPermission.modified_at,
      created_user: newUserPermission.createdBy
        ? `${newUserPermission.createdBy.first_name} ${newUserPermission.createdBy.last_name}`
        : null,
      updated_user: newUserPermission.updatedBy
        ? `${newUserPermission.updatedBy.first_name} ${newUserPermission.updatedBy.last_name}`
        : null,
      status_name: newUserPermission.status
        ? newUserPermission.status.status_name
        : null,
    };
  }

  async update(id: number, updateUserPermissionsDto: any, userId: number) {
    const { user_id, role_id, module_id, action_id, access_key_id, status_id } =
      updateUserPermissionsDto;

    const userPermissionToUpdate = await this.userPermissionsRepository.findOne(
      {
        where: { id },
        relations: [
          "user",
          "role",
          "module",
          "action",
          "accessKey",
          "status",
          "createdBy",
          "updatedBy",
        ],
      },
    );

    if (!userPermissionToUpdate) {
      throw new NotFoundException("User permission not found for update.");
    }

    // Validate entities if provided
    if (user_id !== undefined) {
      const user = await this.userRepository.findOne({
        where: { id: user_id },
      });
      if (!user) {
        throw new BadRequestException(`User with ID ${user_id} not found`);
      }
      userPermissionToUpdate.user_id = user_id;
    }

    if (role_id !== undefined) {
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${role_id} not found`);
      }
      userPermissionToUpdate.role_id = role_id;
    }

    if (module_id !== undefined) {
      const module = await this.moduleRepository.findOne({
        where: { id: module_id },
      });
      if (!module) {
        throw new BadRequestException(`Module with ID ${module_id} not found`);
      }
      userPermissionToUpdate.module_id = module_id;
    }

    if (action_id !== undefined) {
      const action = await this.actionRepository.findOne({
        where: { id: action_id },
      });
      if (!action) {
        throw new BadRequestException(`Action with ID ${action_id} not found`);
      }
      userPermissionToUpdate.action_id = action_id;
    }

    if (access_key_id !== undefined) {
      const accessKey = await this.accessKeyRepository.findOne({
        where: { id: access_key_id },
      });
      if (!accessKey) {
        throw new BadRequestException(
          `Access key with ID ${access_key_id} not found`,
        );
      }
      userPermissionToUpdate.access_key_id = access_key_id;
    }

    if (status_id !== undefined) {
      userPermissionToUpdate.status_id = status_id;
    }

    userPermissionToUpdate.updated_by = userId;

    const savedUserPermission = await this.userPermissionsRepository.save(
      userPermissionToUpdate,
    );

    // Return updated data
    return this.findOne(savedUserPermission.id);
  }

  async remove(id: number) {
    const userPermissionToRemove =
      await this.userPermissionsRepository.findOneBy({ id });

    if (!userPermissionToRemove) {
      throw new NotFoundException("User permission not found for deletion.");
    }

    await this.userPermissionsRepository.remove(userPermissionToRemove);
    return { message: "User permission successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const userPermissionToUpdate = await this.userPermissionsRepository.findOne(
      {
        where: { id },
        relations: [
          "user",
          "role",
          "module",
          "action",
          "accessKey",
          "status",
          "createdBy",
          "updatedBy",
        ],
      },
    );

    if (!userPermissionToUpdate) {
      throw new NotFoundException(
        "User permission not found for status toggle.",
      );
    }

    // Determine new status_id
    let newStatusId: number;
    if (userPermissionToUpdate.status_id === 1) {
      newStatusId = 2; // Set to inactive
    } else if (userPermissionToUpdate.status_id === 2) {
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

    userPermissionToUpdate.status_id = newStatusId;
    userPermissionToUpdate.updated_by = userId;

    await this.userPermissionsRepository.save(userPermissionToUpdate);

    // Return updated data
    const updatedUserPermission = await this.findOne(id);

    return {
      message: `User permission status successfully toggled to ${newStatusEntity.status_name}.`,
      user_permission: updatedUserPermission,
    };
  }
}
