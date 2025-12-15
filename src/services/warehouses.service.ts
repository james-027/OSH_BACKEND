import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Warehouse } from "../entities/Warehouse";
import { UsersService } from "./users.service";
import { CreateWarehouseDto } from "../dto/CreateWarehouseDto";
import { UpdateWarehouseDto } from "../dto/UpdateWarehouseDto";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CommonUtilitiesService } from "./common-utilities.service";

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private warehousesRepository: Repository<Warehouse>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService
  ) {}

  async findAll(
    warehouse_type_id?: number,
    accessKeyId?: number,
    userId?: number,
    roleId?: number
  ): Promise<any[]> {
    const where: any = {};
    if (warehouse_type_id) {
      where.warehouse_type_id = warehouse_type_id;
    }
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }
    if (userId && roleId) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );

      where.location_id = In(allowedLocationIds);
    }
    const warehouses = await this.warehousesRepository.find({
      where,
      relations: [
        "warehouseType",
        "location",
        "segment",
        "status",
        "remStatus",
        "createdBy",
        "updatedBy",
      ],
    });
    return warehouses.map((w) => ({
      id: w.id,
      warehouse_name: w.warehouse_name,
      warehouse_ifs: w.warehouse_ifs,
      warehouse_code: w.warehouse_code,
      warehouse_type_id: w.warehouse_type_id,
      location_id: w.location_id,
      segment_id: w.segment_id,
      address: w.address,
      status_id: w.status_id,
      rem_status_id: w.rem_status_id,
      created_at: w.created_at,
      created_by: w.created_by,
      updated_by: w.updated_by,
      modified_at: w.modified_at,
      warehouse_type_name: w.warehouseType
        ? w.warehouseType.warehouse_type_name
        : null,
      location_name: w.location ? w.location.location_name : null,
      segment_name: w.segment ? w.segment.segment_name : null,
      status_name: w.status ? w.status.status_name : null,
      rem_status_name: w.remStatus ? w.remStatus.status_name : null,
      created_user: w.createdBy
        ? `${w.createdBy.first_name} ${w.createdBy.last_name}`
        : null,
      updated_user: w.updatedBy
        ? `${w.updatedBy.first_name} ${w.updatedBy.last_name}`
        : null,
    }));
  }

  async findAllPerStatus(
    warehouse_type_id?: number,
    statusId?: number,
    accessKeyId?: number,
    userId?: number,
    roleId?: number
  ): Promise<any[]> {
    const where: any = {};
    if (warehouse_type_id) {
      where.warehouse_type_id = warehouse_type_id;
    }
    if (statusId) {
      where.status_id = statusId;
    }
    if (accessKeyId !== undefined) {
      where.access_key_id = accessKeyId;
    }
    if (userId && roleId) {
      const allowedLocationIds =
        await this.commonUtilitiesService.getUserAllowedLocationIds(
          userId,
          roleId
        );
      where.location_id = In(allowedLocationIds);
    }
    const warehouses = await this.warehousesRepository.find({
      where,
      relations: [
        "warehouseType",
        "location",
        "segment",
        "status",
        "remStatus",
        "createdBy",
        "updatedBy",
      ],
    });
    return warehouses.map((w) => ({
      id: w.id,
      warehouse_name: w.warehouse_name,
      warehouse_ifs: w.warehouse_ifs,
      warehouse_code: w.warehouse_code,
      warehouse_type_id: w.warehouse_type_id,
      location_id: w.location_id,
      segment_id: w.segment_id,
      address: w.address,
      status_id: w.status_id,
      created_at: w.created_at,
      created_by: w.created_by,
      updated_by: w.updated_by,
      modified_at: w.modified_at,
      warehouse_type_name: w.warehouseType
        ? w.warehouseType.warehouse_type_name
        : null,
      location_name: w.location ? w.location.location_name : null,
      segment_name: w.segment ? w.segment.segment_name : null,
      status_name: w.status ? w.status.status_name : null,
      rem_status_name: w.remStatus ? w.remStatus.status_name : null,
      created_user: w.createdBy
        ? `${w.createdBy.first_name} ${w.createdBy.last_name}`
        : null,
      updated_user: w.updatedBy
        ? `${w.updatedBy.first_name} ${w.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const w = await this.warehousesRepository.findOne({
      where: { id },
      relations: [
        "warehouseType",
        "location",
        "segment",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    if (!w) throw new NotFoundException(`Warehouse with ID ${id} not found`);
    return {
      id: w.id,
      warehouse_name: w.warehouse_name,
      warehouse_ifs: w.warehouse_ifs,
      warehouse_code: w.warehouse_code,
      warehouse_type_id: w.warehouse_type_id,
      location_id: w.location_id,
      segment_id: w.segment_id,
      address: w.address,
      status_id: w.status_id,
      created_at: w.created_at,
      created_by: w.created_by,
      updated_by: w.updated_by,
      modified_at: w.modified_at,
      warehouse_type_name: w.warehouseType
        ? w.warehouseType.warehouse_type_name
        : null,
      location_name: w.location ? w.location.location_name : null,
      segment_name: w.segment ? w.segment.segment_name : null,
      status_name: w.status ? w.status.status_name : null,
      created_user: w.createdBy
        ? `${w.createdBy.first_name} ${w.createdBy.last_name}`
        : null,
      updated_user: w.updatedBy
        ? `${w.updatedBy.first_name} ${w.updatedBy.last_name}`
        : null,
    };
  }

  async create(createDto: CreateWarehouseDto, userId: number): Promise<any> {
    const exists = await this.warehousesRepository.findOne({
      where: [
        { warehouse_name: createDto.warehouse_name },
        { warehouse_ifs: createDto.warehouse_ifs },
        { warehouse_code: createDto.warehouse_code },
      ],
    });
    if (exists)
      throw new BadRequestException(
        "Warehouse with this name, IFS, or code already exists"
      );
    const newWarehouse = this.warehousesRepository.create({
      ...createDto,
      access_key_id: createDto.access_key_id,
      created_by: userId,
      updated_by: userId,
    });
    try {
      const saved = await this.warehousesRepository.save(newWarehouse);
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehousesService",
          method: "create",
          raw_data: JSON.stringify({ ...createDto }),
          description: `Created warehouse: ${saved.warehouse_name} - ${saved.warehouse_ifs}`,
          status_id: 1,
        },
        userId
      );
      return saved;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseDto,
    userId: number
  ): Promise<any> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id },
    });
    if (!warehouse)
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    if (
      updateDto.warehouse_name ||
      updateDto.warehouse_ifs ||
      updateDto.warehouse_code
    ) {
      const exists = await this.warehousesRepository.findOne({
        where: [
          updateDto.warehouse_name
            ? { warehouse_name: updateDto.warehouse_name }
            : {},
          updateDto.warehouse_ifs
            ? { warehouse_ifs: updateDto.warehouse_ifs }
            : {},
          updateDto.warehouse_code
            ? { warehouse_code: updateDto.warehouse_code }
            : {},
        ],
      });
      if (exists && exists.id !== id)
        throw new BadRequestException(
          "Warehouse with this name, IFS, or code already exists"
        );
    }
    await this.warehousesRepository.update(id, {
      ...updateDto,
      updated_by: userId,
    });
    // Audit trail
    await this.userAuditTrailCreateService.create(
      {
        service: "WarehousesService",
        method: "update",
        raw_data: JSON.stringify({ ...updateDto }),
        description: `Updated warehouse ID: ${id} - ${warehouse.warehouse_ifs}`,
        status_id: 1,
      },
      userId
    );
    return this.warehousesRepository.findOne({ where: { id } });
  }

  async remove(id: number): Promise<void> {
    const warehouse = await this.warehousesRepository.findOne({
      where: { id },
    });
    if (!warehouse)
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    await this.warehousesRepository.remove(warehouse);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const warehouse = await this.warehousesRepository.findOne({
        where: { id },
        relations: [
          "warehouseType",
          "location",
          "segment",
          "status",
          "createdBy",
          "updatedBy",
        ],
      });
      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${id} not found`);
      }
      const newStatusId = warehouse.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "Active" : "Inactive";
      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }
      await this.warehousesRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "WarehousesService",
          method: "toggleStatus",
          raw_data: JSON.stringify({
            id,
            prev_status_id: warehouse.status_id,
            new_status_id: newStatusId,
          }),
          description: `Toggled status to ${newStatusName} for warehouse ID: ${id} - ${warehouse.warehouse_ifs}`,
          status_id: 1,
        },
        userId
      );
      const updatedWarehouse = await this.warehousesRepository.findOne({
        where: { id },
        relations: [
          "warehouseType",
          "location",
          "segment",
          "status",
          "createdBy",
          "updatedBy",
        ],
      });
      if (!updatedWarehouse) {
        throw new Error("Failed to retrieve updated warehouse");
      }
      return {
        id: updatedWarehouse.id,
        warehouse_name: updatedWarehouse.warehouse_name,
        warehouse_ifs: updatedWarehouse.warehouse_ifs,
        warehouse_code: updatedWarehouse.warehouse_code,
        warehouse_type_id: updatedWarehouse.warehouse_type_id,
        location_id: updatedWarehouse.location_id,
        segment_id: updatedWarehouse.segment_id,
        address: updatedWarehouse.address,
        status_id: updatedWarehouse.status_id,
        created_at: updatedWarehouse.created_at,
        created_by: updatedWarehouse.created_by,
        updated_by: updatedWarehouse.updated_by,
        modified_at: updatedWarehouse.modified_at,
        warehouse_type_name: updatedWarehouse.warehouseType
          ? updatedWarehouse.warehouseType.warehouse_type_name
          : null,
        location_name: updatedWarehouse.location
          ? updatedWarehouse.location.location_name
          : null,
        segment_name: updatedWarehouse.segment
          ? updatedWarehouse.segment.segment_name
          : null,
        status_name: updatedWarehouse.status
          ? updatedWarehouse.status.status_name
          : null,
        created_user: updatedWarehouse.createdBy
          ? `${updatedWarehouse.createdBy.first_name} ${updatedWarehouse.createdBy.last_name}`
          : null,
        updated_user: updatedWarehouse.updatedBy
          ? `${updatedWarehouse.updatedBy.first_name} ${updatedWarehouse.updatedBy.last_name}`
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error toggling warehouse status:", error);
      throw new Error("Failed to toggle warehouse status");
    }
  }
}
