import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Brand } from "../../../entities/Brand";
import { UsersService } from "../../users/services/users.service";
import { CreateBrandDto } from "../dto/CreateBrandDto";
import { UpdateBrandDto } from "../dto/UpdateBrandDto";
import { ResponseMapperService } from "src/services/response-mapper.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";
@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private brandsRepository: Repository<Brand>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
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
    try {
      const existingBrand = await this.brandsRepository.findOne({
        where: {
          brand_name: createBrandDto.brand_name,
        },
      });

      if (existingBrand) {
        throw new BadRequestException("Brand with this name already exists");
      }

      const createdByUser = await this.usersService.findUserById(userId);

      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newBrand = this.brandsRepository.create({
        brand_name: createBrandDto.brand_name,
        brand_abbr: createBrandDto.brand_abbr,
        brand_group_id: createBrandDto.brand_group_id,
        status_id: createBrandDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedBrand = await this.brandsRepository.save(newBrand);

      const brandWithRelations = await this.brandsRepository.findOne({
        where: { id: savedBrand.id },
        relations: ["status", "createdBy", "updatedBy", "brandGroup"],
      });

      if (!brandWithRelations) {
        throw new Error("Failed to retrieve created brand");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandsService",
          method: "create",
          raw_data: JSON.stringify(brandWithRelations),
          description: `Created brand ${brandWithRelations.brand_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(brandWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("brands", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to create brand",
        error: err,
      });
    }
  }

  async update(
    id: number,
    updateBrandDto: UpdateBrandDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingBrand = await this.brandsRepository.findOne({
        where: { id },
      });

      if (!existingBrand) {
        throw new NotFoundException(`Brand with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateBrandDto.brand_name) {
        const duplicateBrand = await this.brandsRepository.findOne({
          where: {
            brand_name: updateBrandDto.brand_name,
          },
        });

        if (duplicateBrand && duplicateBrand.id !== id) {
          throw new BadRequestException("Brand with this name already exists");
        }
      }

      await this.brandsRepository.update(id, {
        ...updateBrandDto,
        updated_by: userId,
      });

      const brandWithRelations = await this.brandsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy", "brandGroup"],
      });

      if (!brandWithRelations) {
        throw new Error("Failed to retrieve updated brand");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandsService",
          method: "update",
          raw_data: JSON.stringify(brandWithRelations),
          description: `Updated brand ${brandWithRelations.brand_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(brandWithRelations);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("brands", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to update brand",
        error: err,
      });
    }
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

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStatusId = brand.status_id === 1 ? 2 : 1;

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

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedBrand),
          description: `${
            newStatusId === 1 ? "Activated" : "Deactivated"
          } brand ${updatedBrand.brand_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedBrand);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("brands", response.id, response);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return response;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const err = error as Error;

      throw new InternalServerErrorException({
        message: "Failed to toggle brand status",
        error: err,
      });
    }
  }
}
