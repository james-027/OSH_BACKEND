import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Brand } from "../../../entities/Brand";
import { UsersService } from "../../users/services/users.service";
import { CreateBrandDto } from "../dto/CreateBrandDto";
import { UpdateBrandDto } from "../dto/UpdateBrandDto";

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brandsRepository: Repository<Brand>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<any[]> {
    const brands = await this.brandsRepository.find({
      relations: ["status", "createdBy", "updatedBy", "brandGroup"],
    });
    return brands.map((brand) => ({
      id: brand.id,
      brand_name: brand.brand_name,
      brand_abbr: brand.brand_abbr,
      status_id: brand.status_id,
      created_at: brand.created_at,
      created_by: brand.created_by,
      updated_by: brand.updated_by,
      modified_at: brand.modified_at,
      status_name: brand.status ? brand.status.status_name : null,
      created_user: brand.createdBy
        ? `${brand.createdBy.first_name} ${brand.createdBy.last_name}`
        : null,
      updated_user: brand.updatedBy
        ? `${brand.updatedBy.first_name} ${brand.updatedBy.last_name}`
        : null,
      brand_group_id: brand.brand_group_id,
      brand_group_name: brand.brandGroup
        ? brand.brandGroup.brand_group_name
        : null,
    }));
  }

  async findOne(id: number): Promise<any> {
    const brand = await this.brandsRepository.findOne({
      where: { id },
      relations: ["status", "createdBy", "updatedBy", "brandGroup"],
    });
    if (!brand) throw new NotFoundException(`Brand with ID ${id} not found`);
    return {
      id: brand.id,
      brand_name: brand.brand_name,
      brand_abbr: brand.brand_abbr,
      status_id: brand.status_id,
      created_at: brand.created_at,
      created_by: brand.created_by,
      updated_by: brand.updated_by,
      modified_at: brand.modified_at,
      status_name: brand.status ? brand.status.status_name : null,
      created_user: brand.createdBy
        ? `${brand.createdBy.first_name} ${brand.createdBy.last_name}`
        : null,
      updated_user: brand.updatedBy
        ? `${brand.updatedBy.first_name} ${brand.updatedBy.last_name}`
        : null,
      brand_group_id: brand.brand_group_id,
      brand_group_name: brand.brandGroup
        ? brand.brandGroup.brand_group_name
        : null,
    };
  }

  async create(createBrandDto: CreateBrandDto, userId: number): Promise<any> {
    const existing = await this.brandsRepository.findOne({
      where: { brand_name: createBrandDto.brand_name },
    });
    if (existing)
      throw new BadRequestException("Brand with this name already exists");
    const newBrand = this.brandsRepository.create({
      ...createBrandDto,
      status_id: createBrandDto.status_id || 1,
      brand_group_id: createBrandDto.brand_group_id,
      created_by: userId,
      updated_by: userId,
    });
    const saved = await this.brandsRepository.save(newBrand);
    return this.findOne(saved.id);
  }

  async update(
    id: number,
    updateBrandDto: UpdateBrandDto,
    userId: number,
  ): Promise<any> {
    const brand = await this.brandsRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException(`Brand with ID ${id} not found`);
    if (updateBrandDto.brand_name) {
      const existing = await this.brandsRepository.findOne({
        where: { brand_name: updateBrandDto.brand_name },
      });
      if (existing && existing.id !== id)
        throw new BadRequestException("Brand with this name already exists");
    }
    await this.brandsRepository.update(id, {
      ...updateBrandDto,
      updated_by: userId,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const brand = await this.brandsRepository.findOne({ where: { id } });
    if (!brand) throw new NotFoundException(`Brand with ID ${id} not found`);
    await this.brandsRepository.remove(brand);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const brand = await this.brandsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "brandGroup"],
      });
      if (!brand) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }
      const newStatusId = brand.status_id === 1 ? 2 : 1;
      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }
      await this.brandsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });
      const updatedBrand = await this.brandsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "brandGroup"],
      });
      if (!updatedBrand) {
        throw new Error("Failed to retrieve updated brand");
      }
      return {
        id: updatedBrand.id,
        brand_name: updatedBrand.brand_name,
        brand_abbr: updatedBrand.brand_abbr,
        status_id: updatedBrand.status_id,
        created_at: updatedBrand.created_at,
        created_by: updatedBrand.created_by,
        updated_by: updatedBrand.updated_by,
        modified_at: updatedBrand.modified_at,
        status_name: updatedBrand.status
          ? updatedBrand.status.status_name
          : null,
        created_user: updatedBrand.createdBy
          ? `${updatedBrand.createdBy.first_name} ${updatedBrand.createdBy.last_name}`
          : null,
        updated_user: updatedBrand.updatedBy
          ? `${updatedBrand.updatedBy.first_name} ${updatedBrand.updatedBy.last_name}`
          : null,
        brand_group_id: updatedBrand.brand_group_id,
        brand_group_name: updatedBrand.brandGroup
          ? updatedBrand.brandGroup.brand_group_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error toggling brand status:", error);
      throw new Error("Failed to toggle brand status");
    }
  }
}
