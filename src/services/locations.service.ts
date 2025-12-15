import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Location } from "../entities/Location";
import { UsersService } from "./users.service";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";

import { CreateLocationDto } from "../dto/CreateLocationDto";
import { UpdateLocationDto } from "../dto/UpdateLocationDto";
import { CommonUtilitiesService } from "./common-utilities.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
    private usersService: UsersService,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private commonUtilitiesService: CommonUtilitiesService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  // async getUserLocationIds(userId: number, roleId: number) {
  //   return this.usersService["userLocationsRepository"].find({
  //     where: { user_id: userId, role_id: roleId, status_id: 1 },
  //     select: ["location_id"],
  //   });
  // }

  async findAll(userId?: number, roleId?: number): Promise<any[]> {
    try {
      let allowedLocationIds: number[] | undefined = undefined;

      if (userId && roleId) {
        allowedLocationIds =
          await this.commonUtilitiesService.getUserAllowedLocationIds(
            userId,
            roleId
          );
      }
      const where: any = {};
      if (allowedLocationIds && allowedLocationIds.length > 0) {
        where.id = In(allowedLocationIds);
      }
      const locations = await this.locationsRepository.find({
        where,
        relations: [
          "locationType",
          "status",
          "createdBy",
          "updatedBy",
          "region",
        ],
      });

      return locations.map((location) => ({
        id: location.id,
        location_name: location.location_name,
        location_code: location.location_code,
        location_type_id: location.location_type_id,
        status_id: location.status_id,
        created_at: location.created_at,
        created_by: location.created_by,
        updated_by: location.updated_by,
        modified_at: location.modified_at,
        created_user: location.createdBy
          ? `${location.createdBy.first_name} ${location.createdBy.last_name}`
          : null,
        updated_user: location.updatedBy
          ? `${location.updatedBy.first_name} ${location.updatedBy.last_name}`
          : null,
        status_name: location.status ? location.status.status_name : null,
        location_type_name: location.locationType
          ? location.locationType.location_type_name
          : null,
        region_id: location.region_id,
        region_name: location.region ? location.region.region_name : null,
        location_abbr: location.location_abbr,
      }));
    } catch (error) {
      console.error("Error fetching locations:", error);
      throw new Error("Failed to fetch locations");
    }
  }

  async findOne(id: number): Promise<any> {
    try {
      const location = await this.locationsRepository.findOne({
        where: { id },
        relations: [
          "locationType",
          "status",
          "createdBy",
          "updatedBy",
          "region",
        ],
      });

      if (!location) {
        throw new NotFoundException(`Location with ID ${id} not found`);
      }

      return {
        id: location.id,
        location_name: location.location_name,
        location_code: location.location_code,
        location_type_id: location.location_type_id,
        status_id: location.status_id,
        created_at: location.created_at,
        created_by: location.created_by,
        updated_by: location.updated_by,
        modified_at: location.modified_at,
        created_user: location.createdBy
          ? `${location.createdBy.first_name} ${location.createdBy.last_name}`
          : null,
        updated_user: location.updatedBy
          ? `${location.updatedBy.first_name} ${location.updatedBy.last_name}`
          : null,
        status_name: location.status ? location.status.status_name : null,
        location_type_name: location.locationType
          ? location.locationType.location_type_name
          : null,
        region_id: location.region_id,
        region_name: location.region ? location.region.region_name : null,
        location_abbr: location.location_abbr,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error fetching location:", error);
      throw new Error("Failed to fetch location");
    }
  }

  async create(
    createLocationDto: CreateLocationDto,
    userId: number
  ): Promise<any> {
    try {
      // Check for duplicate location name
      const existingLocation = await this.locationsRepository.findOne({
        where: [
          { location_name: createLocationDto.location_name },
          { location_code: createLocationDto.location_code },
        ],
      });

      if (existingLocation) {
        throw new BadRequestException(
          "Location with this name or code already exists"
        );
      }

      const createdByUser = await this.usersService.findUserById(userId);
      if (!createdByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      const newLocation = this.locationsRepository.create({
        location_name: createLocationDto.location_name,
        location_code: createLocationDto.location_code,
        location_abbr: createLocationDto.location_abbr,
        location_type_id: createLocationDto.location_type_id,
        status_id: createLocationDto.status_id || 1,
        region_id: createLocationDto.region_id,
        created_by: userId,
        updated_by: userId,
      });

      const savedLocation = await this.locationsRepository.save(newLocation);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "LocationsService",
          method: "create",
          raw_data: JSON.stringify(createLocationDto),
          description: `Created location: ${savedLocation.location_name}`,
          status_id: 1,
        },
        userId
      );

      const locationWithRelations = await this.locationsRepository.findOne({
        where: { id: savedLocation.id },
        relations: [
          "locationType",
          "status",
          "createdBy",
          "updatedBy",
          "region",
        ],
      });

      if (!locationWithRelations) {
        throw new Error("Failed to retrieve created location");
      }

      const locationResponse = {
        id: locationWithRelations.id,
        location_name: locationWithRelations.location_name,
        location_code: locationWithRelations.location_code,
        location_abbr: locationWithRelations.location_abbr,
        location_type_id: locationWithRelations.location_type_id,
        status_id: locationWithRelations.status_id,
        created_at: locationWithRelations.created_at,
        created_by: locationWithRelations.created_by,
        updated_by: locationWithRelations.updated_by,
        modified_at: locationWithRelations.modified_at,
        created_user: locationWithRelations.createdBy
          ? `${locationWithRelations.createdBy.first_name} ${locationWithRelations.createdBy.last_name}`
          : null,
        updated_user: locationWithRelations.updatedBy
          ? `${locationWithRelations.updatedBy.first_name} ${locationWithRelations.updatedBy.last_name}`
          : null,
        status_name: locationWithRelations.status
          ? locationWithRelations.status.status_name
          : null,
        location_type_name: locationWithRelations.locationType
          ? locationWithRelations.locationType.location_type_name
          : null,
        region_id: locationWithRelations.region_id,
        region_name: locationWithRelations.region
          ? locationWithRelations.region.region_name
          : null,
      };

      // SSE Events (choose which one to use based on frontend approach)
      try {
        // Option 1: WITH data (for Approach 1 - pure SSE on frontend)
        // this.sseEventEmitter.emitCreate('locations', locationResponse.id, locationResponse);

        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitCreateSignal("locations", locationResponse.id);
      } catch (err) {
        console.warn("SSE event failed:", err);
      }

      return locationResponse;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error("Error creating location:", error);
      throw new Error("Failed to create location");
    }
  }

  async update(
    id: number,
    updateLocationDto: UpdateLocationDto,
    userId: number
  ): Promise<any> {
    try {
      const location = await this.locationsRepository.findOne({
        where: { id },
        relations: ["createdBy"],
      });

      if (!location) {
        throw new NotFoundException(`Location with ID ${id} not found`);
      }

      // Check for unique constraint if updating name or code
      if (updateLocationDto.location_name || updateLocationDto.location_code) {
        const existingLocation = await this.locationsRepository.findOne({
          where: [
            updateLocationDto.location_name
              ? { location_name: updateLocationDto.location_name }
              : {},
            updateLocationDto.location_code
              ? { location_code: updateLocationDto.location_code }
              : {},
          ],
        });

        if (existingLocation && existingLocation.id !== id) {
          throw new BadRequestException(
            "Location with this name or code already exists"
          );
        }
      }

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.locationsRepository.update(id, {
        ...updateLocationDto,
        updated_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "LocationsService",
          method: "update",
          raw_data: JSON.stringify(updateLocationDto),
          description: `Updated location ID: ${id} - ${location.location_name}`,
          status_id: 1,
        },
        userId
      );

      const updatedLocation = await this.locationsRepository.findOne({
        where: { id },
        relations: [
          "locationType",
          "status",
          "createdBy",
          "updatedBy",
          "region",
        ],
      });

      if (!updatedLocation) {
        throw new Error("Failed to retrieve updated location");
      }

      const locationResponse = {
        id: updatedLocation.id,
        location_name: updatedLocation.location_name,
        location_code: updatedLocation.location_code,
        location_type_id: updatedLocation.location_type_id,
        status_id: updatedLocation.status_id,
        created_at: updatedLocation.created_at,
        created_by: updatedLocation.created_by,
        updated_by: updatedLocation.updated_by,
        modified_at: updatedLocation.modified_at,
        created_user: updatedLocation.createdBy
          ? `${updatedLocation.createdBy.first_name} ${updatedLocation.createdBy.last_name}`
          : null,
        updated_user: updatedLocation.updatedBy
          ? `${updatedLocation.updatedBy.first_name} ${updatedLocation.updatedBy.last_name}`
          : null,
        status_name: updatedLocation.status
          ? updatedLocation.status.status_name
          : null,
        location_type_name: updatedLocation.locationType
          ? updatedLocation.locationType.location_type_name
          : null,
        region_id: updatedLocation.region_id,
        region_name: updatedLocation.region
          ? updatedLocation.region.region_name
          : null,
        location_abbr: updatedLocation.location_abbr,
      };

      // SSE Events (choose which one to use based on frontend approach)
      try {
        // Option 1: WITH data (for Approach 1 - pure SSE on frontend)
        // this.sseEventEmitter.emitUpdate('locations', id, locationResponse);

        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitUpdateSignal("locations", id);
      } catch (err) {
        console.warn("SSE event failed for update:", err);
      }

      return locationResponse;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error updating location:", error);
      throw new Error("Failed to update location");
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const location = await this.locationsRepository.findOne({
        where: { id },
      });

      if (!location) {
        throw new NotFoundException(`Location with ID ${id} not found`);
      }

      await this.locationsRepository.remove(location);

      // SSE Events (choose which one to use based on frontend approach)
      try {
        // Option 1: WITH data (for Approach 1 - pure SSE on frontend)
        // Delete event doesn't need data, but keeping for consistency
        // this.sseEventEmitter.emitDelete('locations', id);

        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitDeleteSignal("locations", id);
      } catch (err) {
        console.warn("SSE event failed:", err);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error("Error deleting location:", error);
      throw new Error("Failed to delete location");
    }
  }

  async toggleStatus(id: number, userId: number): Promise<any> {
    try {
      const location = await this.locationsRepository.findOne({
        where: { id },
        relations: ["locationType", "status", "createdBy", "updatedBy"],
      });

      if (!location) {
        throw new NotFoundException(`Location with ID ${id} not found`);
      }

      const newStatusId = location.status_id === 1 ? 2 : 1;
      const newStatusName = newStatusId === 1 ? "Active" : "Inactive";

      const updatedByUser = await this.usersService.findUserById(userId);
      if (!updatedByUser) {
        throw new BadRequestException("Authenticated user not found");
      }

      await this.locationsRepository.update(id, {
        status_id: newStatusId,
        updated_by: userId,
      });

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "LocationsService",
          method: "toggleStatus",
          raw_data: JSON.stringify({
            id,
            prev_status_id: location.status_id,
            new_status_id: newStatusId,
          }),
          description: `Toggled status to ${newStatusName} for location ID: ${id} - ${location.location_name}`,
          status_id: 1,
        },
        userId
      );

      const updatedLocation = await this.locationsRepository.findOne({
        where: { id },
        relations: [
          "locationType",
          "status",
          "createdBy",
          "updatedBy",
          "region",
        ],
      });

      if (!updatedLocation) {
        throw new Error("Failed to retrieve updated location");
      }

      const locationResponse = {
        id: updatedLocation.id,
        location_name: updatedLocation.location_name,
        location_code: updatedLocation.location_code,
        location_type_id: updatedLocation.location_type_id,
        status_id: updatedLocation.status_id,
        created_at: updatedLocation.created_at,
        created_by: updatedLocation.created_by,
        updated_by: updatedLocation.updated_by,
        modified_at: updatedLocation.modified_at,
        created_user: updatedLocation.createdBy
          ? `${updatedLocation.createdBy.first_name} ${updatedLocation.createdBy.last_name}`
          : null,
        updated_user: updatedLocation.updatedBy
          ? `${updatedLocation.updatedBy.first_name} ${updatedLocation.updatedBy.last_name}`
          : null,
        status_name: updatedLocation.status
          ? updatedLocation.status.status_name
          : null,
        location_type_name: updatedLocation.locationType
          ? updatedLocation.locationType.location_type_name
          : null,
        region_id: updatedLocation.region_id,
        region_name: updatedLocation.region
          ? updatedLocation.region.region_name
          : null,
        location_abbr: updatedLocation.location_abbr,
      };

      // SSE Events (choose which one to use based on frontend approach)
      try {
        // Option 1: WITH data (for Approach 1 - pure SSE on frontend)
        // this.sseEventEmitter.emitUpdate('locations', id, locationResponse);

        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitUpdateSignal("locations", id);
      } catch (err) {
        console.warn("SSE event failed for update:", err);
      }

      return locationResponse;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error("Error toggling location status:", error);
      throw new Error("Failed to toggle location status");
    }
  }
}
