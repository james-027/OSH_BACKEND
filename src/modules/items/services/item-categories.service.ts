import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ItemCategory } from "src/entities/ItemCategory";
import { CreateItemCategoryDto } from "../dto/CreateItemCategoryDto";
import { UpdateItemCategoryDto } from "../dto/UpdateItemCategoryDto";
import { UsersService } from "src/modules/users/services/users.service";

@Injectable()
export class ItemCategoriesService {
  constructor(
    @InjectRepository(ItemCategory)
    private itemCategoriesRepository: Repository<ItemCategory>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const categories = await this.itemCategoriesRepository.find({
      relations: ["status", "createdBy", "updatedBy"],
    });
    return categories.map((cat) => ({
      id: cat.id,
      code: cat.code,
      name: cat.name,
      level: cat.level,
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
    const cat = await this.itemCategoriesRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy"],
    });
    if (!cat) throw new NotFoundException("Item category not found");
    return {
      id: cat.id,
      code: cat.code,
      name: cat.name,
      level: cat.level,
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
    createDto: CreateItemCategoryDto,
    userId: number,
  ): Promise<ItemCategory> {
    const exists = await this.itemCategoriesRepository.findOne({
      where: { code: createDto.code },
    });
    if (exists)
      throw new BadRequestException("Item category code already exists");
    const cat = this.itemCategoriesRepository.create({
      ...createDto,
      status_id: createDto.status_id || 1,
      created_by: userId,
      updated_by: userId,
    });
    return this.itemCategoriesRepository.save(cat);
  }

  async update(
    id: number,
    updateDto: UpdateItemCategoryDto,
    userId: number,
  ): Promise<ItemCategory> {
    const cat = await this.itemCategoriesRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Item category not found");
    Object.assign(cat, updateDto, { updated_by: userId });
    return this.itemCategoriesRepository.save(cat);
  }

  async remove(id: number): Promise<void> {
    const cat = await this.itemCategoriesRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Item category not found");
    await this.itemCategoriesRepository.remove(cat);
  }

  async toggleStatus(id: number, userId: number): Promise<ItemCategory> {
    const cat = await this.itemCategoriesRepository.findOne({ where: { id } });
    if (!cat) throw new NotFoundException("Item category not found");
    cat.status_id = cat.status_id === 1 ? 2 : 1;
    cat.updated_by = userId;
    return this.itemCategoriesRepository.save(cat);
  }
}
