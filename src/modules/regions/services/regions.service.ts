import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Region } from "src/entities/Region";
import { CreateRegionDto } from "../dto/CreateRegionDto";
import { UpdateRegionDto } from "../dto/UpdateRegionDto";
import { UsersService } from "src/modules/users/services/users.service";
import { SSEEventEmitterHelper } from "src/modules/sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private regionsRepository: Repository<Region>,
    private usersService: UsersService,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async create(createRegionDto: CreateRegionDto, userId: number): Promise<any> {
    try {
      // Check for unique constraints
      const existingRegion = await this.regionsRepository.findOne({
        where: [{ region_name: createRegionDto.region_name }],
      });

      if (existingRegion) {
        throw new BadRequestException("Region with this name already exists");
      }

      // Verify user exists
      const user = await this.usersService.findUserById(userId);
      if (!user) {
        throw new BadRequestException("User not found");
      }

      const region = this.regionsRepository.create({
        ...createRegionDto,
        created_by: userId,
        status_id: createRegionDto.status_id || 1, // Default to active
      });

      const savedRegion = await this.regionsRepository.save(region);

      // Fetch the complete region with relations
      const completeRegion = await this.regionsRepository.findOne({
        where: { id: savedRegion.id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      // SSE Events
      try {
        this.sseEventEmitter.emitCreateSignal("regions", completeRegion.id);
      } catch (err) {
        logger.error("SSE event failed:", err);
      }

      return {
        id: completeRegion.id,
        region_name: completeRegion.region_name,
        region_abbr: completeRegion.region_abbr,
        status_id: completeRegion.status_id,
        created_at: completeRegion.created_at,
        created_by: completeRegion.created_by,
        updated_by: completeRegion.updated_by,
        modified_at: completeRegion.modified_at,
        created_user: completeRegion.createdBy
          ? `${completeRegion.createdBy.first_name} ${completeRegion.createdBy.last_name}`
          : null,
        updated_user: completeRegion.updatedBy
          ? `${completeRegion.updatedBy.first_name} ${completeRegion.updatedBy.last_name}`
          : null,
        status_name: completeRegion.status
          ? completeRegion.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error creating region:", error);
      throw new Error("Failed to create region");
    }
  }

  async findAll(): Promise<any[]> {
    try {
      const regions = await this.regionsRepository.find({
        relations: ["status", "createdBy", "updatedBy"],
        order: { created_at: "DESC" },
      });

      return regions.map((region) => ({
        id: region.id,
        region_name: region.region_name,
        region_abbr: region.region_abbr,
        status_id: region.status_id,
        created_at: region.created_at,
        created_by: region.created_by,
        updated_by: region.updated_by,
        modified_at: region.modified_at,
        created_user: region.createdBy
          ? `${region.createdBy.first_name} ${region.createdBy.last_name}`
          : null,
        updated_user: region.updatedBy
          ? `${region.updatedBy.first_name} ${region.updatedBy.last_name}`
          : null,
        status_name: region.status ? region.status.status_name : null,
      }));
    } catch (error) {
      console.error("Error fetching regions:", error);
      throw new Error("Failed to fetch regions");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const region = await this.regionsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!region) {
        throw new NotFoundException(`Region with ID ${id} not found`);
      }

      return {
        id: region.id,
        region_name: region.region_name,
        region_abbr: region.region_abbr,
        status_id: region.status_id,
        created_at: region.created_at,
        created_by: region.created_by,
        updated_by: region.updated_by,
        modified_at: region.modified_at,
        created_user: region.createdBy
          ? `${region.createdBy.first_name} ${region.createdBy.last_name}`
          : null,
        updated_user: region.updatedBy
          ? `${region.updatedBy.first_name} ${region.updatedBy.last_name}`
          : null,
        status_name: region.status ? region.status.status_name : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error finding region:", error);
      throw new Error("Failed to find region");
    }
  }

  async update(
    id: number,
    updateRegionDto: UpdateRegionDto,
    userId: number,
  ): Promise<any> {
    try {
      const region = await this.regionsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!region) {
        throw new NotFoundException(`Region with ID ${id} not found`);
      }

      // Check for unique constraints if updating name
      if (updateRegionDto.region_name) {
        const existingRegion = await this.regionsRepository.findOne({
          where: { region_name: updateRegionDto.region_name },
        });

        if (existingRegion && existingRegion.id !== id) {
          throw new BadRequestException("Region with this name already exists");
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.regionsRepository.update(id, {
        ...updateRegionDto,
        updated_by: userId,
      });

      const updatedRegion = await this.regionsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedRegion) {
        throw new Error("Failed to retrieve updated region");
      }

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("regions", updatedRegion.id);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedRegion.id,
        region_name: updatedRegion.region_name,
        region_abbr: updatedRegion.region_abbr,
        status_id: updatedRegion.status_id,
        created_at: updatedRegion.created_at,
        created_by: updatedRegion.created_by,
        updated_by: updatedRegion.updated_by,
        modified_at: updatedRegion.modified_at,
        created_user: updatedRegion.createdBy
          ? `${updatedRegion.createdBy.first_name} ${updatedRegion.createdBy.last_name}`
          : null,
        updated_user: updatedRegion.updatedBy
          ? `${updatedRegion.updatedBy.first_name} ${updatedRegion.updatedBy.last_name}`
          : null,
        status_name: updatedRegion.status
          ? updatedRegion.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error updating region:", error);
      throw new Error("Failed to update region");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const region = await this.regionsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!region) {
        throw new NotFoundException(`Region with ID ${id} not found`);
      }

      const newStatusId = region.status_id === 1 ? 2 : 1;

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.regionsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      const updatedRegion = await this.regionsRepository.findOne({
        where: { id },
        relations: ["status", "createdBy", "updatedBy"],
      });

      if (!updatedRegion) {
        throw new Error("Failed to retrieve updated region");
      }

      // SSE Events
      try {
        this.sseEventEmitter.emitUpdateSignal("regions", updatedRegion.id);
      } catch (err) {
        logger.error("SSE event failed for update:", err);
      }

      return {
        id: updatedRegion.id,
        region_name: updatedRegion.region_name,
        region_abbr: updatedRegion.region_abbr,
        status_id: updatedRegion.status_id,
        created_at: updatedRegion.created_at,
        created_by: updatedRegion.created_by,
        updated_by: updatedRegion.updated_by,
        modified_at: updatedRegion.modified_at,
        created_user: updatedRegion.createdBy
          ? `${updatedRegion.createdBy.first_name} ${updatedRegion.createdBy.last_name}`
          : null,
        updated_user: updatedRegion.updatedBy
          ? `${updatedRegion.updatedBy.first_name} ${updatedRegion.updatedBy.last_name}`
          : null,
        status_name: updatedRegion.status
          ? updatedRegion.status.status_name
          : null,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error toggling region status:", error);
      throw new Error("Failed to toggle region status");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const region = await this.regionsRepository.findOne({ where: { id } });

      if (!region) {
        throw new NotFoundException(`Region with ID ${id} not found`);
      }

      await this.regionsRepository.delete(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting region:", error);
      throw new Error("Failed to delete region");
    }
  }
}
