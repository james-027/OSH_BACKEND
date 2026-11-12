import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { UserWarehouses } from "../../../entities/UserWarehouses";
import { UserLocations } from "../../../entities/UserLocations";
import { Warehouse } from "../../../entities/Warehouse";
import { User } from "../../../entities/User";
import { Role } from "../../../entities/Role";
import { AccessKey } from "../../../entities/AccessKey";
import { Status } from "../../../entities/Status";
import { CreateUserWarehousesDto } from "../dto/CreateUserWarehousesDto";
import { UpdateUserWarehousesDto } from "../dto/UpdateUserWarehousesDto";

@Injectable()
export class UserWarehousesService {
  constructor(
    @InjectRepository(UserWarehouses)
    private userWarehousesRepository: Repository<UserWarehouses>,
    @InjectRepository(UserLocations)
    private userLocationsRepository: Repository<UserLocations>,
    @InjectRepository(Warehouse)
    private warehouseRepository: Repository<Warehouse>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  /**
   * Find all user warehouses, grouped by user, role, and access_key combination
   */
  async findAll(accessKeyId?: number) {
    const where: any = {};
    if (accessKeyId) {
      where.access_key_id = accessKeyId;
    }

    const userWarehouses = await this.userWarehousesRepository.find({
      where,
      relations: [
        "user",
        "role",
        "warehouse",
        "warehouse.location",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
      order: { id: "ASC" },
    });

    // Group by user_id, role_id, and access_key_id combination
    const groupedWarehouses = userWarehouses.reduce((acc, uw) => {
      const key = `${uw.user_id}_${uw.role_id}_${uw.access_key_id}`;

      if (!acc[key]) {
        acc[key] = {
          id: uw.id,
          user_id: uw.user_id,
          user_full_name: uw.user
            ? `${uw.user.first_name} ${uw.user.last_name}`
            : null,
          role_id: uw.role_id,
          role_name: uw.role ? uw.role.role_name : null,
          access_key_id: uw.access_key_id,
          access_key_name: uw.accessKey ? uw.accessKey.access_key_name : null,
          warehouse_id: [],
          warehouse_name: [],
          warehouse_code: [],
          location_id: [],
          location_name: [],
          status_id: uw.status_id,
          created_at: uw.created_at,
          created_by: uw.created_by,
          updated_by: uw.updated_by || null,
          modified_at: uw.modified_at,
          created_user: uw.createdBy
            ? `${uw.createdBy.first_name} ${uw.createdBy.last_name}`
            : null,
          updated_user: uw.updatedBy
            ? `${uw.updatedBy.first_name} ${uw.updatedBy.last_name}`
            : null,
          status_name: uw.status ? uw.status.status_name : null,
          // Track detailed list for frontend convenience
          warehouses: [],
        };
      }

      if (uw.status_id === 1) {
        acc[key].warehouse_id.push(uw.warehouse_id);
        acc[key].warehouse_name.push(
          uw.warehouse ? uw.warehouse.warehouse_name : null,
        );
        acc[key].warehouse_code.push(
          uw.warehouse ? uw.warehouse.warehouse_code : null,
        );

        if (uw.warehouse?.location_id) {
          if (!acc[key].location_id.includes(uw.warehouse.location_id)) {
            acc[key].location_id.push(uw.warehouse.location_id);
            acc[key].location_name.push(
              uw.warehouse.location
                ? uw.warehouse.location.location_name
                : null,
            );
          }
        }

        acc[key].warehouses.push({
          id: uw.id,
          warehouse_id: uw.warehouse_id,
          warehouse_name: uw.warehouse ? uw.warehouse.warehouse_name : null,
          warehouse_code: uw.warehouse ? uw.warehouse.warehouse_code : null,
          location_id: uw.warehouse?.location_id || null,
          location_name: uw.warehouse?.location?.location_name || null,
          status_id: uw.status_id,
        });
      }

      return acc;
    }, {} as any);

    return Object.values(groupedWarehouses);
  }

  /**
   * Find single record or grouped view by ID
   */
  async findOne(id: number) {
    const target = await this.userWarehousesRepository.findOne({
      where: { id },
      relations: [
        "user",
        "role",
        "warehouse",
        "warehouse.location",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!target) {
      throw new NotFoundException(`User warehouse with ID ${id} not found`);
    }

    // Get all records for this (user, role, accessKey)
    const siblings = await this.userWarehousesRepository.find({
      where: {
        user_id: target.user_id,
        role_id: target.role_id,
        access_key_id: target.access_key_id,
      },
      relations: [
        "user",
        "role",
        "warehouse",
        "warehouse.location",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    const activeSiblings = siblings.filter((s) => s.status_id === 1);

    return {
      id: target.id,
      user_id: target.user_id,
      user_full_name: target.user
        ? `${target.user.first_name} ${target.user.last_name}`
        : null,
      role_id: target.role_id,
      role_name: target.role ? target.role.role_name : null,
      access_key_id: target.access_key_id,
      access_key_name: target.accessKey
        ? target.accessKey.access_key_name
        : null,
      warehouse_id: activeSiblings.map((s) => s.warehouse_id),
      warehouse_name: activeSiblings.map((s) =>
        s.warehouse ? s.warehouse.warehouse_name : null,
      ),
      warehouse_code: activeSiblings.map((s) =>
        s.warehouse ? s.warehouse.warehouse_code : null,
      ),
      warehouses: activeSiblings.map((s) => ({
        id: s.id,
        warehouse_id: s.warehouse_id,
        warehouse_name: s.warehouse ? s.warehouse.warehouse_name : null,
        warehouse_code: s.warehouse ? s.warehouse.warehouse_code : null,
        location_id: s.warehouse?.location_id || null,
        location_name: s.warehouse?.location?.location_name || null,
        status_id: s.status_id,
      })),
      status_id: target.status_id,
      status_name: target.status ? target.status.status_name : null,
      created_at: target.created_at,
      created_by: target.created_by,
      updated_by: target.updated_by,
      modified_at: target.modified_at,
      created_user: target.createdBy
        ? `${target.createdBy.first_name} ${target.createdBy.last_name}`
        : null,
      updated_user: target.updatedBy
        ? `${target.updatedBy.first_name} ${target.updatedBy.last_name}`
        : null,
    };
  }

  /**
   * Helper to retrieve assigned warehouses for a specific user, role, and tenant
   */
  async findByUserAndRole(
    userId: number,
    roleId: number,
    accessKeyId?: number,
  ) {
    const whereClause: any = {
      user_id: userId,
      role_id: roleId,
      status_id: 1,
    };
    if (accessKeyId) {
      whereClause.access_key_id = accessKeyId;
    }

    const assigned = await this.userWarehousesRepository.find({
      where: whereClause,
      relations: ["warehouse", "warehouse.location"],
    });

    return assigned.map((uw) => ({
      id: uw.id,
      warehouse_id: uw.warehouse_id,
      warehouse_name: uw.warehouse?.warehouse_name || null,
      warehouse_code: uw.warehouse?.warehouse_code || null,
      location_id: uw.warehouse?.location_id || null,
      location_name: uw.warehouse?.location?.location_name || null,
      access_key_id: uw.access_key_id,
      status_id: uw.status_id,
    }));
  }

  /**
   * Create or sync user warehouses with strict user_locations validation and soft deactivation
   */
  async create(dto: CreateUserWarehousesDto, authUserId: number) {
    const {
      user_id,
      role_id,
      access_key_id = 1,
      warehouse_ids,
      status_id = 1,
    } = dto;

    // 1. Validate basic references
    const user = await this.userRepository.findOne({ where: { id: user_id } });
    if (!user) {
      throw new BadRequestException(`User with ID ${user_id} not found`);
    }

    const role = await this.roleRepository.findOne({ where: { id: role_id } });
    if (!role) {
      throw new BadRequestException(`Role with ID ${role_id} not found`);
    }

    // 2. Validate allowed locations for this user under (user_id, role_id, access_key_id)
    const allowedUserLocations = await this.userLocationsRepository.find({
      where: {
        user_id,
        role_id,
        access_key_id,
        status_id: 1,
      },
      select: ["location_id"],
    });

    const allowedLocationIds = allowedUserLocations.map((ul) => ul.location_id);
    if (allowedLocationIds.length === 0) {
      throw new BadRequestException(
        `User ${user_id} has no active assigned locations for Role ${role_id} and Access Key ${access_key_id}. Warehouses cannot be assigned.`,
      );
    }

    // 3. Validate warehouses existence and verify they belong to allowed locations
    const warehouses = await this.warehouseRepository.find({
      where: { id: In(warehouse_ids) },
      relations: ["location"],
    });

    if (warehouses.length !== warehouse_ids.length) {
      const foundIds = new Set(warehouses.map((w) => w.id));
      const missingIds = warehouse_ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Warehouse IDs not found: ${missingIds.join(", ")}`,
      );
    }

    // Strict validation: every warehouse must respect user_locations
    const invalidWarehouses = warehouses.filter(
      (w) => !allowedLocationIds.includes(w.location_id),
    );

    if (invalidWarehouses.length > 0) {
      const invalidDetails = invalidWarehouses
        .map(
          (w) =>
            `'${w.warehouse_name}' (ID: ${w.id}, Location: ${w.location?.location_name || w.location_id})`,
        )
        .join(", ");
      throw new BadRequestException(
        `The following warehouses do not belong to the user's allowed locations: ${invalidDetails}`,
      );
    }

    // 4. Soft-deactivation sync logic (NO DELETE)
    // Find all existing records for this user + role + accessKey
    const existingRecords = await this.userWarehousesRepository.find({
      where: {
        user_id,
        role_id,
        access_key_id,
      },
    });

    const existingMap = new Map<number, UserWarehouses>();
    existingRecords.forEach((r) => existingMap.set(r.warehouse_id, r));

    const toSave: UserWarehouses[] = [];

    // Tagged warehouses -> status_id = 1 (or provided status_id)
    for (const warehouseId of warehouse_ids) {
      if (existingMap.has(warehouseId)) {
        const existing = existingMap.get(warehouseId)!;
        existing.status_id = status_id;
        existing.updated_by = authUserId;
        toSave.push(existing);
        existingMap.delete(warehouseId);
      } else {
        const newRecord = this.userWarehousesRepository.create({
          user_id,
          role_id,
          warehouse_id: warehouseId,
          access_key_id,
          status_id,
          created_by: authUserId,
        });
        toSave.push(newRecord);
      }
    }

    // Untagged warehouses -> soft deactivate (status_id = 2) - NO DELETE!
    for (const [, remainingRecord] of existingMap) {
      if (remainingRecord.status_id !== 2) {
        remainingRecord.status_id = 2;
        remainingRecord.updated_by = authUserId;
        toSave.push(remainingRecord);
      }
    }

    if (toSave.length > 0) {
      await this.userWarehousesRepository.save(toSave);
    }

    return this.findOne(toSave[0]?.id || existingRecords[0]?.id || 0);
  }

  /**
   * Update user warehouses by group ID with location validation and soft-deactivation (NO DELETE)
   */
  async update(id: number, dto: UpdateUserWarehousesDto, authUserId: number) {
    const existing = await this.userWarehousesRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`User warehouse with ID ${id} not found`);
    }

    const userId = dto.user_id || existing.user_id;
    const roleId = dto.role_id || existing.role_id;
    const accessKeyId = dto.access_key_id || existing.access_key_id;
    const statusId = dto.status_id !== undefined ? dto.status_id : 1;

    return this.create(
      {
        user_id: userId,
        role_id: roleId,
        access_key_id: accessKeyId,
        warehouse_ids: dto.warehouse_ids,
        status_id: statusId,
      },
      authUserId,
    );
  }

  /**
   * Soft deactivate a user warehouse record (sets status_id = 2, NO DELETE)
   */
  async deactivate(id: number, authUserId: number) {
    const userWarehouse = await this.userWarehousesRepository.findOne({
      where: { id },
    });

    if (!userWarehouse) {
      throw new NotFoundException(`User warehouse with ID ${id} not found`);
    }

    userWarehouse.status_id = 2; // Deactivated
    userWarehouse.updated_by = authUserId;

    await this.userWarehousesRepository.save(userWarehouse);

    return {
      message: `User warehouse ID ${id} deactivated successfully (status_id = 2)`,
      id: userWarehouse.id,
      status_id: userWarehouse.status_id,
    };
  }

  /**
   * Toggle status between active (1) and inactive (2)
   */
  async toggleStatus(id: number, authUserId: number) {
    const userWarehouse = await this.userWarehousesRepository.findOne({
      where: { id },
    });

    if (!userWarehouse) {
      throw new NotFoundException(`User warehouse with ID ${id} not found`);
    }

    userWarehouse.status_id = userWarehouse.status_id === 1 ? 2 : 1;
    userWarehouse.updated_by = authUserId;

    await this.userWarehousesRepository.save(userWarehouse);

    return {
      message: `User warehouse ID ${id} status toggled to ${userWarehouse.status_id}`,
      id: userWarehouse.id,
      status_id: userWarehouse.status_id,
    };
  }
}
