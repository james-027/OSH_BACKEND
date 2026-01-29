import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, In, Repository } from "typeorm";
import { LocationHurdleCategory } from "../entities/LocationHurdleCategory";
import { CreateLocationHurdleCategoryDto } from "../dto/CreateLocationHurdleCategoryDto";
import { UpdateLocationHurdleCategoryDto } from "../dto/UpdateLocationHurdleCategoryDto";

@Injectable()
export class LocationHurdleCategoriesService {
  constructor(
    @InjectRepository(LocationHurdleCategory)
    private lhcRepository: Repository<LocationHurdleCategory>,
  ) {}

  async findAll(): Promise<any[]> {
    const cats = await this.lhcRepository.find({
      relations: [
        "location",
        "itemCategory",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    return cats.map((cat) => ({
      id: cat.id,
      location_id: cat.location_id,
      location_name: cat.location ? cat.location.location_name : null,
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
    const cat = await this.lhcRepository.findOne({
      where: { id },
      relations: [
        "location",
        "itemCategory",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });
    if (!cat) throw new NotFoundException("Location hurdle category not found");
    return {
      id: cat.id,
      location_id: cat.location_id,
      location_name: cat.location ? cat.location.location_name : null,
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
    dto: CreateLocationHurdleCategoryDto,
    userId: number,
  ): Promise<LocationHurdleCategory> {
    const exists = await this.lhcRepository.findOne({
      where: {
        location_id: dto.location_id,
        item_category_id: dto.item_category_id,
      },
    });
    if (exists) {
      // Neglect creation if combination exists
      return exists;
    }
    const entity = this.lhcRepository.create({
      ...dto,
      created_by: userId,
      updated_by: userId,
    });
    return this.lhcRepository.save(entity);
  }

  async update(
    id: number,
    dto: UpdateLocationHurdleCategoryDto,
    userId: number,
  ): Promise<LocationHurdleCategory> {
    const cat = await this.lhcRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Location hurdle category not found");
    if (
      dto.location_id !== undefined &&
      dto.item_category_id !== undefined &&
      (dto.location_id !== cat.location_id ||
        dto.item_category_id !== cat.item_category_id)
    ) {
      const exists = await this.lhcRepository.findOne({
        where: {
          location_id: dto.location_id,
          item_category_id: dto.item_category_id,
          id: Not(id),
        },
      });
      if (exists) {
        throw new Error("Location and category already exists");
      }
    }
    Object.assign(cat, dto, { updated_by: userId });
    return this.lhcRepository.save(cat);
  }

  async remove(id: number): Promise<void> {
    const cat = await this.lhcRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Location hurdle category not found");
    await this.lhcRepository.remove(cat);
  }

  async toggleStatus(
    id: number,
    active: boolean,
    userId: number,
  ): Promise<LocationHurdleCategory> {
    const cat = await this.lhcRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Location hurdle category not found");
    cat.status_id = active ? 1 : 2; // 1 = active, 2 = inactive (adjust as needed)
    cat.updated_by = userId;
    return this.lhcRepository.save(cat);
  }

  async bulkCreateExtension(
    location_hurdle_id: number,
    location_ids: number[],
    item_category_ids: number[],
    userId: number,
  ): Promise<LocationHurdleCategory[]> {
    const records: LocationHurdleCategory[] = [];
    for (const location_id of location_ids) {
      for (const item_category_id of item_category_ids) {
        const exists = await this.lhcRepository.findOne({
          where: { location_hurdle_id, location_id, item_category_id },
        });
        if (!exists) {
          const entity = this.lhcRepository.create({
            location_hurdle_id,
            location_id,
            item_category_id,
            created_by: userId,
            updated_by: userId,
            status_id: 3, // pending status
          });
          records.push(entity);
        }
      }
    }
    return this.lhcRepository.save(records);
  }

  async bulkUpdateExtension(
    location_hurdle_id: number,
    location_ids: number[],
    item_category_ids: number[],
    userId: number,
  ): Promise<LocationHurdleCategory[]> {
    // 1. Deactivate all records for this location_hurdle_id
    await this.lhcRepository.update(
      { location_hurdle_id },
      { status_id: 2, updated_by: userId },
    );

    const results: LocationHurdleCategory[] = [];

    for (const location_id of location_ids) {
      for (const item_category_id of item_category_ids) {
        let cat = await this.lhcRepository.findOne({
          where: { location_hurdle_id, location_id, item_category_id },
        });
        if (cat) {
          // Reactivate if exists
          cat.status_id = 3; // 3 = pending status
          cat.updated_by = userId;
          cat = await this.lhcRepository.save(cat);
        } else {
          // Create new if not exists
          cat = this.lhcRepository.create({
            location_hurdle_id,
            location_id,
            item_category_id,
            status_id: 3, // 3 = pending status
            created_by: userId,
            updated_by: userId,
          });
          cat = await this.lhcRepository.save(cat);
        }
        results.push(cat);
      }
    }

    return results;
  }

  async deactivateByLocationHurdleId(
    location_hurdle_id: number,
    userId: number,
  ): Promise<void> {
    const cats = await this.lhcRepository.find({
      where: { location_hurdle_id },
    });
    for (const cat of cats) {
      cat.status_id = 2; // 2 = inactive
      cat.updated_by = userId;
      await this.lhcRepository.save(cat);
    }
  }

  async updateStatusByLocationHurdleId(
    location_hurdle_id: number,
    status_id: number,
    userId: number,
  ): Promise<void> {
    const cats = await this.lhcRepository.find({
      where: { location_hurdle_id },
    });
    for (const cat of cats) {
      cat.status_id = status_id;
      cat.updated_by = userId;
      await this.lhcRepository.save(cat);
    }
  }

  async updateStatusByLocationHurdleIds(
    location_hurdle_ids: number[],
    status_id: number,
    userId: number,
  ): Promise<void> {
    await this.lhcRepository.update(
      { location_hurdle_id: In(location_hurdle_ids) },
      { status_id, updated_by: userId },
    );
  }

  async existsExtension(
    location_hurdle_id: number,
    location_ids: number[],
    item_category_ids: number[],
    excludeId?: number,
  ): Promise<boolean> {
    const where: any = {
      location_id: In(location_ids),
      item_category_id: In(item_category_ids),
    };
    if (excludeId !== undefined) {
      where.id = Not(location_hurdle_id);
    }

    const count = await this.lhcRepository.count({ where });
    return count > 0;
  }
}
