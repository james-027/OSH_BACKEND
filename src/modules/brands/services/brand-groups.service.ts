import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BrandGroup } from "../../../entities/BrandGroup";
import { UsersService } from "../../users/services/users.service";
import { CreateBrandGroupDto } from "../dto/CreateBrandGroupDto";
import { UpdateBrandGroupDto } from "../dto/UpdateBrandGroupDto";

@Injectable()
export class BrandGroupsService {
  constructor(
    @InjectRepository(BrandGroup)
    private brandGroupsRepository: Repository<BrandGroup>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const groups = await this.brandGroupsRepository.find({
      relations: ["status", "createdBy", "updatedBy"],
    });
    return groups.map((group) => ({
      id: group.id,
      brand_group_name: group.brand_group_name,
      brand_group_abbr: group.brand_group_abbr,
      status_id: group.status_id,
      created_at: group.created_at,
      created_by: group.created_by,
      updated_by: group.updated_by,
      modified_at: group.modified_at,
      status_name: group.status ? group.status.status_name : null,
      created_user: group.createdBy
        ? `${group.createdBy.first_name} ${group.createdBy.last_name}`
        : null,
      updated_user: group.updatedBy
        ? `${group.updatedBy.first_name} ${group.updatedBy.last_name}`
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const group = await this.brandGroupsRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy"],
    });
    if (!group)
      throw new NotFoundException(`BrandGroup with ID ${id} not found`);
    return {
      id: group.id,
      brand_group_name: group.brand_group_name,
      brand_group_abbr: group.brand_group_abbr,
      status_id: group.status_id,
      created_at: group.created_at,
      created_by: group.created_by,
      updated_by: group.updated_by,
      modified_at: group.modified_at,
      status_name: group.status ? group.status.status_name : null,
      created_user: group.createdBy
        ? `${group.createdBy.first_name} ${group.createdBy.last_name}`
        : null,
      updated_user: group.updatedBy
        ? `${group.updatedBy.first_name} ${group.updatedBy.last_name}`
        : null,
    };
  }

  async create(createDto: CreateBrandGroupDto, userId: number): Promise<any> {
    const existing = await this.brandGroupsRepository.findOne({
      where: { brand_group_name: createDto.brand_group_name },
    });
    if (existing)
      throw new BadRequestException(
        "Brand group with this name already exists",
      );
    const newGroup = this.brandGroupsRepository.create({
      ...createDto,
      status_id: createDto.status_id || 1,
      created_by: userId,
      updated_by: userId,
    });
    const saved = await this.brandGroupsRepository.save(newGroup);
    return this.findOne(saved.id);
  }

  async update(
    id: number,
    updateDto: UpdateBrandGroupDto,
    userId: number,
  ): Promise<any> {
    const group = await this.brandGroupsRepository.findOne({ where: { id } });
    if (!group)
      throw new NotFoundException(`BrandGroup with ID ${id} not found`);
    if (updateDto.brand_group_name) {
      const existing = await this.brandGroupsRepository.findOne({
        where: { brand_group_name: updateDto.brand_group_name },
      });
      if (existing && existing.id !== id)
        throw new BadRequestException(
          "Brand group with this name already exists",
        );
    }
    await this.brandGroupsRepository.update(id, {
      ...updateDto,
      updated_by: userId,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const group = await this.brandGroupsRepository.findOne({ where: { id } });
    if (!group)
      throw new NotFoundException(`BrandGroup with ID ${id} not found`);
    await this.brandGroupsRepository.remove(group);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    const group = await this.brandGroupsRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy"],
    });
    if (!group) {
      throw new NotFoundException(`BrandGroup with ID ${id} not found`);
    }
    const newStatusId = group.status_id === 1 ? 2 : 1;
    const updatedByUser = await this.usersService.findUserById(userId);
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found");
    }
    await this.brandGroupsRepository.update(id, {
      status_id: newStatusId,
      updated_by: userId,
    });
    return this.findOne(id);
  }
}
