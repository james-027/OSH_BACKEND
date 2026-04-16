import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, In, Repository } from "typeorm";
import { WarehouseHurdleCategory } from "../../../entities/WarehouseHurdleCategory";
import { CreateWarehouseHurdleCategoryDto } from "../dto/CreateWarehouseHurdleCategoryDto";
import { UpdateWarehouseHurdleCategoryDto } from "../dto/UpdateWarehouseHurdleCategoryDto";

@Injectable()
export class WarehouseHurdleCategoriesService {
  constructor(
    @InjectRepository(WarehouseHurdleCategory)
    private whcRepository: Repository<WarehouseHurdleCategory>,
  ) {}

  async findAll(): Promise<any[]> {
    const cats = await this.whcRepository.find({
      relations: [
        "warehouse",
        "itemCategory",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    return cats.map((cat) => ({
      id: cat.id,
      warehouse_id: cat.warehouse_id,
      warehouse_name: cat.warehouse ? cat.warehouse.warehouse_name : null,
      item_category_id: cat.item_category_id,
      item_category_name: cat.itemCategory ? cat.itemCategory.name : null,
      item_category_code: cat.itemCategory ? cat.itemCategory.code : null,
      status_id: cat.status_id,
      status_name: cat.status ? cat.status.status_name : null,
      created_at: cat.created_at,
      created_by: cat.created_by,
      updated_by: cat.updated_by,
      modified_at: cat.modified_at,
      created_user: cat.createdBy
        ? `${cat.createdBy.first_name} ${cat.createdBy.last_name}`
        : null,
      updated_user: cat.updatedBy
        ? `${cat.updatedBy.first_name} ${cat.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const cat = await this.whcRepository.findOne({
      where: { id },
      relations: [
        "warehouse",
        "itemCategory",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    if (!cat)
      throw new NotFoundException("Warehouse hurdle category not found");
    return {
      id: cat.id,
      warehouse_id: cat.warehouse_id,
      warehouse_name: cat.warehouse ? cat.warehouse.warehouse_name : null,
      item_category_id: cat.item_category_id,
      item_category_name: cat.itemCategory ? cat.itemCategory.name : null,
      item_category_code: cat.itemCategory ? cat.itemCategory.code : null,
      status_id: cat.status_id,
      status_name: cat.status ? cat.status.status_name : null,
      created_at: cat.created_at,
      created_by: cat.created_by,
      updated_by: cat.updated_by,
      modified_at: cat.modified_at,
      created_user: cat.createdBy
        ? `${cat.createdBy.first_name} ${cat.createdBy.last_name}`
        : null,
      updated_user: cat.updatedBy
        ? `${cat.updatedBy.first_name} ${cat.updatedBy.last_name}`
        : null,
    };
  }

  async create(
    dto: CreateWarehouseHurdleCategoryDto,
    userId: number,
  ): Promise<WarehouseHurdleCategory> {
    const exists = await this.whcRepository.findOne({
      where: {
        warehouse_id: dto.warehouse_id,
        item_category_id: dto.item_category_id,
      },
    });
    if (exists) {
      // Neglect creation if combination exists
      return exists;
    }
    const entity = this.whcRepository.create({
      ...dto,
      created_by: userId,
      updated_by: userId,
    });
    return this.whcRepository.save(entity);
  }

  async update(
    id: number,
    dto: UpdateWarehouseHurdleCategoryDto,
    userId: number,
  ): Promise<WarehouseHurdleCategory> {
    const cat = await this.whcRepository.findOne({ where: { id } });
    if (!cat)
      throw new NotFoundException("Warehouse hurdle category not found");
    if (
      dto.warehouse_id !== undefined &&
      dto.item_category_id !== undefined &&
      (dto.warehouse_id !== cat.warehouse_id ||
        dto.item_category_id !== cat.item_category_id)
    ) {
      const exists = await this.whcRepository.findOne({
        where: {
          warehouse_id: dto.warehouse_id,
          item_category_id: dto.item_category_id,
          id: Not(id),
        },
      });
      if (exists) {
        throw new Error("Warehouse and category already exists");
      }
    }
    Object.assign(cat, dto, { updated_by: userId });
    return this.whcRepository.save(cat);
  }

  async remove(id: number): Promise<void> {
    const cat = await this.whcRepository.findOne({ where: { id } });
    if (!cat)
      throw new NotFoundException("Warehouse hurdle category not found");
    await this.whcRepository.remove(cat);
  }

  async toggleStatus(
    id: number,
    active: boolean,
    userId: number,
  ): Promise<WarehouseHurdleCategory> {
    const cat = await this.whcRepository.findOne({ where: { id } });
    if (!cat)
      throw new NotFoundException("Warehouse hurdle category not found");
    cat.status_id = active ? 1 : 2; // 1 = active, 2 = inactive (adjust as needed)
    cat.updated_by = userId;
    return this.whcRepository.save(cat);
  }

  async bulkCreateExtension(
    warehouse_hurdle_id: number,
    warehouse_ids: number[],
    item_category_ids: number[],
    userId: number,
  ): Promise<WarehouseHurdleCategory[]> {
    const records: WarehouseHurdleCategory[] = [];
    for (const warehouse_id of warehouse_ids) {
      for (const item_category_id of item_category_ids) {
        const exists = await this.whcRepository.findOne({
          where: { warehouse_hurdle_id, warehouse_id, item_category_id },
        });
        if (!exists) {
          const entity = this.whcRepository.create({
            warehouse_hurdle_id,
            warehouse_id,
            item_category_id,
            created_by: userId,
            updated_by: userId,
            status_id: 3, // pending status
          });
          records.push(entity);
        }
      }
    }
    return this.whcRepository.save(records);
  }

  async bulkUpdateExtension(
    warehouse_hurdle_id: number,
    warehouse_ids: number[],
    item_category_ids: number[],
    userId: number,
  ): Promise<WarehouseHurdleCategory[]> {
    // 1. Deactivate all records for this warehouse_hurdle_id
    await this.whcRepository.update(
      { warehouse_hurdle_id },
      { status_id: 2, updated_by: userId },
    );

    const results: WarehouseHurdleCategory[] = [];

    for (const warehouse_id of warehouse_ids) {
      for (const item_category_id of item_category_ids) {
        let cat = await this.whcRepository.findOne({
          where: { warehouse_hurdle_id, warehouse_id, item_category_id },
        });
        if (cat) {
          // Reactivate if exists
          cat.status_id = 3; // 3 = pending status
          cat.updated_by = userId;
          cat = await this.whcRepository.save(cat);
        } else {
          // Create new if not exists
          cat = this.whcRepository.create({
            warehouse_hurdle_id,
            warehouse_id,
            item_category_id,
            status_id: 3, // 3 = pending status
            created_by: userId,
            updated_by: userId,
          });
          cat = await this.whcRepository.save(cat);
        }
        results.push(cat);
      }
    }

    return results;
  }

  async deactivateByWarehouseHurdleId(
    warehouse_hurdle_id: number,
    userId: number,
  ): Promise<void> {
    const cats = await this.whcRepository.find({
      where: { warehouse_hurdle_id },
    });
    for (const cat of cats) {
      cat.status_id = 2; // 2 = inactive
      cat.updated_by = userId;
      await this.whcRepository.save(cat);
    }
  }

  async updateStatusByWarehouseHurdleId(
    warehouse_hurdle_id: number,
    status_id: number,
    userId: number,
  ): Promise<void> {
    const cats = await this.whcRepository.find({
      where: { warehouse_hurdle_id },
    });
    for (const cat of cats) {
      cat.status_id = status_id;
      cat.updated_by = userId;
      await this.whcRepository.save(cat);
    }
  }

  async updateStatusByWarehouseHurdleIds(
    warehouse_hurdle_ids: number[],
    status_id: number,
    userId: number,
  ): Promise<void> {
    await this.whcRepository.update(
      { warehouse_hurdle_id: In(warehouse_hurdle_ids) },
      { status_id, updated_by: userId },
    );
  }

  async existsExtension(
    warehouse_hurdle_id: number,
    warehouse_ids: number[],
    item_category_ids: number[],
    excludeId?: number,
  ): Promise<boolean> {
    const where: any = {
      //   warehouse_hurdle_id,
      warehouse_id: In(warehouse_ids),
      item_category_id: In(item_category_ids),
    };
    if (excludeId !== undefined) {
      where.id = Not(warehouse_hurdle_id);
    }

    const count = await this.whcRepository.count({ where });
    return count > 0;
  }
}
