import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WarehouseType } from "../../../entities/WarehouseType";
import { UsersService } from "../../users/services/users.service";
import { CreateWarehouseTypeDto } from "../dto/CreateWarehouseTypeDto";
import { UpdateWarehouseTypeDto } from "../dto/UpdateWarehouseTypeDto";

@Injectable()
export class WarehouseTypesService {
  constructor(
    @InjectRepository(WarehouseType)
    private warehouseTypesRepository: Repository<WarehouseType>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const types = await this.warehouseTypesRepository.find({
      relations: ["status", "createdBy", "updatedBy"],
    });
    return types.map((type) => ({
      id: type.id,
      warehouse_type_name: type.warehouse_type_name,
      warehouse_type_abbr: type.warehouse_type_abbr,
      status_id: type.status_id,
      created_at: type.created_at,
      created_by: type.created_by,
      updated_by: type.updated_by,
      modified_at: type.modified_at,
      status_name: type.status ? type.status.status_name : null,
      created_user: type.createdBy
        ? `${type.createdBy.first_name} ${type.createdBy.last_name}`
        : null,
      updated_user: type.updatedBy
        ? `${type.updatedBy.first_name} ${type.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const type = await this.warehouseTypesRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy"],
    });
    if (!type)
      throw new NotFoundException(`WarehouseType with ID ${id} not found`);
    return {
      id: type.id,
      warehouse_type_name: type.warehouse_type_name,
      warehouse_type_abbr: type.warehouse_type_abbr,
      status_id: type.status_id,
      created_at: type.created_at,
      created_by: type.created_by,
      updated_by: type.updated_by,
      modified_at: type.modified_at,
      status_name: type.status ? type.status.status_name : null,
      created_user: type.createdBy
        ? `${type.createdBy.first_name} ${type.createdBy.last_name}`
        : null,
      updated_user: type.updatedBy
        ? `${type.updatedBy.first_name} ${type.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    createDto: CreateWarehouseTypeDto,
    userId: number,
  ): Promise<any> {
    const existing = await this.warehouseTypesRepository.findOne({
      where: { warehouse_type_name: createDto.warehouse_type_name },
    });
    if (existing)
      throw new BadRequestException(
        "Warehouse type with this name already exists",
      );
    const newType = this.warehouseTypesRepository.create({
      ...createDto,
      status_id: createDto.status_id || 1,
      created_by: userId,
      updated_by: userId,
    });
    const saved = await this.warehouseTypesRepository.save(newType);
    return this.findOne(saved.id);
  }

  async update(
    id: number,
    updateDto: UpdateWarehouseTypeDto,
    userId: number,
  ): Promise<any> {
    const type = await this.warehouseTypesRepository.findOne({ where: { id } });
    if (!type)
      throw new NotFoundException(`WarehouseType with ID ${id} not found`);
    if (updateDto.warehouse_type_name) {
      const existing = await this.warehouseTypesRepository.findOne({
        where: { warehouse_type_name: updateDto.warehouse_type_name },
      });
      if (existing && existing.id !== id)
        throw new BadRequestException(
          "Warehouse type with this name already exists",
        );
    }
    await this.warehouseTypesRepository.update(id, {
      ...updateDto,
      updated_by: userId,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const type = await this.warehouseTypesRepository.findOne({ where: { id } });
    if (!type)
      throw new NotFoundException(`WarehouseType with ID ${id} not found`);
    await this.warehouseTypesRepository.remove(type);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const type = await this.warehouseTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });
      if (!type) {
        throw new NotFoundException(`WarehouseType with ID ${id} not found`);
      }
      const newStatusId = type.status_id === 1 ? 2 : 1;
      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }
      await this.warehouseTypesRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });
      const updatedType = await this.warehouseTypesRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });
      if (!updatedType) {
        throw new Error("Failed to retrieve updated warehouse type");
      }
      return {
        id: updatedType.id,
        warehouse_type_name: updatedType.warehouse_type_name,
        warehouse_type_abbr: updatedType.warehouse_type_abbr,
        status_id: updatedType.status_id,
        created_at: updatedType.created_at,
        created_by: updatedType.created_by,
        updated_by: updatedType.updated_by,
        modified_at: updatedType.modified_at,
        status_name: updatedType.status ? updatedType.status.status_name : null,
        created_user: updatedType.createdBy
          ? `${updatedType.createdBy.first_name} ${updatedType.createdBy.last_name}`
          : null,
        updated_user: updatedType.updatedBy
          ? `${updatedType.updatedBy.first_name} ${updatedType.updatedBy.last_name}`
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error toggling warehouse type status:", error);
      throw new Error("Failed to toggle warehouse type status");
    }
  }
}
