import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Item } from "src/entities/Item";
import { CreateItemDto } from "../dto/CreateItemDto";
import { UpdateItemDto } from "../dto/UpdateItemDto";
import { UsersService } from "src/modules/users/services/users.service";

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const items = await this.itemsRepository.find({
      relations: ["category1", "category2", "status", "createdBy", "updatedBy"],
    });
    return items.map((item) => ({
      id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      item_group: item.item_group,
      uom: item.uom,
      uom_sa: item.uom_sa,
      category1_id: item.category1_id,
      category1_name: item.category1 ? item.category1.name : null,
      category2_id: item.category2_id,
      category2_name: item.category2 ? item.category2.name : null,
      sales_conv: Number(item.sales_conv),
      sales_unit_eq: Number(item.sales_unit_eq),
      status_id: item.status_id,
      status_name: item.status ? item.status.status_name : null,
      created_at: item.created_at,
      created_by: item.created_by,
      updated_by: item.updated_by,
      modified_at: item.modified_at,
      created_user: item.createdBy
        ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
        : null,
      updated_user: item.updatedBy
        ? `${item.updatedBy.first_name} ${item.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: ["category1", "category2", "status", "createdBy", "updatedBy"],
    });
    if (!item) throw new NotFoundException("Item not found");
    return {
      id: item.id,
      item_code: item.item_code,
      item_name: item.item_name,
      item_group: item.item_group,
      uom: item.uom,
      uom_sa: item.uom_sa,
      category1_id: item.category1_id,
      category1_name: item.category1 ? item.category1.name : null,
      category2_id: item.category2_id,
      category2_name: item.category2 ? item.category2.name : null,
      sales_conv: Number(item.sales_conv),
      sales_unit_eq: Number(item.sales_unit_eq),
      status_id: item.status_id,
      status_name: item.status ? item.status.status_name : null,
      created_at: item.created_at,
      created_by: item.created_by,
      updated_by: item.updated_by,
      modified_at: item.modified_at,
      created_user: item.createdBy
        ? `${item.createdBy.first_name} ${item.createdBy.last_name}`
        : null,
      updated_user: item.updatedBy
        ? `${item.updatedBy.first_name} ${item.updatedBy.last_name}`
        : null,
    };
  }

  async create(createDto: CreateItemDto, userId: number): Promise<Item> {
    const exists = await this.itemsRepository.findOne({
      where: { item_code: createDto.item_code },
    });
    if (exists) throw new BadRequestException("Item code already exists");
    const item = this.itemsRepository.create({
      ...createDto,
      sales_conv: Number(createDto.sales_conv),
      sales_unit_eq: Number(createDto.sales_unit_eq),
      status_id: createDto.status_id || 1,
      created_by: userId,
      updated_by: userId,
    });
    return this.itemsRepository.save(item);
  }

  async update(
    id: number,
    updateDto: UpdateItemDto,
    userId: number,
  ): Promise<Item> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException("Item not found");
    Object.assign(item, updateDto, {
      sales_conv:
        updateDto.sales_conv !== undefined
          ? Number(updateDto.sales_conv)
          : item.sales_conv,
      sales_unit_eq:
        updateDto.sales_unit_eq !== undefined
          ? Number(updateDto.sales_unit_eq)
          : item.sales_unit_eq,
      updated_by: userId,
    });
    return this.itemsRepository.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException("Item not found");
    await this.itemsRepository.remove(item);
  }

  async toggleStatus(id: number, userId: number): Promise<Item> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException("Item not found");
    item.status_id = item.status_id === 1 ? 2 : 1;
    item.updated_by = userId;
    return this.itemsRepository.save(item);
  }
}
