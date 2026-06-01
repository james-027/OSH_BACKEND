import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BrandGroup } from "../../../entities/BrandGroup";
import { UsersService } from "../../users/services/users.service";
import { CreateBrandGroupDto } from "../dto/CreateBrandGroupDto";
import { UpdateBrandGroupDto } from "../dto/UpdateBrandGroupDto";
import { ResponseMapperService } from "src/services/response-mapper.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";
import { UserAuditTrailCreateService } from "src/modules/users/services/user-audit-trail-create.service";

@Injectable()
export class BrandGroupsService {
  constructor(
    @InjectRepository(BrandGroup)
    private brandGroupsRepository: Repository<BrandGroup>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private responseMapperService: ResponseMapperService,
    private sseEventEmitter: SSEEventEmitterHelper,
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
    try {
      const existingBrandGroup = await this.brandGroupsRepository.findOne({
        where: {
          brand_group_name: createDto.brand_group_name,
        },
      });

      if (existingBrandGroup) {
        throw new BadRequestException(
          "Brand group with this name already exists",
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);

      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newBrandGroup = this.brandGroupsRepository.create({
        brand_group_name: createDto.brand_group_name,
        brand_group_abbr: createDto.brand_group_abbr,
        status_id: createDto.status_id || 1,
        created_by: userId,
        updated_by: userId,
      });

      const savedBrandGroup =
        await this.brandGroupsRepository.save(newBrandGroup);

      const brandGroupWithRelations = await this.brandGroupsRepository.findOne({
        where: {
          id: savedBrandGroup.id,
        },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!brandGroupWithRelations) {
        throw new Error("Failed to retrieve created brand group");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandGroupsService",
          method: "create",
          raw_data: JSON.stringify(brandGroupWithRelations),
          description: `Created brand group ${brandGroupWithRelations.brand_group_name}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        brandGroupWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitCreate("brand_groups", response.id, response);
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
        message: "Failed to create brand group",
        error: err,
      });
    }
  }

  async update(
    id: number,
    updateDto: UpdateBrandGroupDto,
    userId: number,
  ): Promise<any> {
    try {
      const existingBrandGroup = await this.brandGroupsRepository.findOne({
        where: { id },
      });

      if (!existingBrandGroup) {
        throw new NotFoundException(`BrandGroup with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      if (updateDto.brand_group_name) {
        const duplicateBrandGroup = await this.brandGroupsRepository.findOne({
          where: {
            brand_group_name: updateDto.brand_group_name,
          },
        });

        if (duplicateBrandGroup && duplicateBrandGroup.id !== id) {
          throw new BadRequestException(
            "Brand group with this name already exists",
          );
        }
      }

      await this.brandGroupsRepository.update(id, {
        ...updateDto,
        updated_by: userId,
      });

      const brandGroupWithRelations = await this.brandGroupsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!brandGroupWithRelations) {
        throw new Error("Failed to retrieve updated brand group");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandGroupsService",
          method: "update",
          raw_data: JSON.stringify(brandGroupWithRelations),
          description: `Updated brand group ${brandGroupWithRelations.brand_group_name}`,
          status_id: 1,
        },
        userId,
      );

      const response = this.responseMapperService.mapEntityToResponse(
        brandGroupWithRelations,
      );

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("brand_groups", response.id, response);
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
        message: "Failed to update brand group",
        error: err,
      });
    }
  }

  async remove(id: number): Promise<void> {
    const group = await this.brandGroupsRepository.findOne({ where: { id } });
    if (!group)
      throw new NotFoundException(`BrandGroup with ID ${id} not found`);
    await this.brandGroupsRepository.remove(group);
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const brandGroup = await this.brandGroupsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!brandGroup) {
        throw new NotFoundException(`BrandGroup with ID ${id} not found`);
      }

      const updatedByUser = await this.usersService.findUserById(userId);

      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newStatusId = brandGroup.status_id === 1 ? 2 : 1;

      await this.brandGroupsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      const updatedBrandGroup = await this.brandGroupsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedBrandGroup) {
        throw new Error("Failed to retrieve updated brand group");
      }

      // Audit Trail
      await this.userAuditTrailCreateService.create(
        {
          service: "BrandGroupsService",
          method: "toggleStatus",
          raw_data: JSON.stringify(updatedBrandGroup),
          description: `${
            newStatusId === 1 ? "Activated" : "Deactivated"
          } brand group ${updatedBrandGroup.brand_group_name}`,
          status_id: 1,
        },
        userId,
      );

      const response =
        this.responseMapperService.mapEntityToResponse(updatedBrandGroup);

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdate("brand_groups", response.id, response);
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
        message: "Failed to toggle brand group status",
        error: err,
      });
    }
  }
}
