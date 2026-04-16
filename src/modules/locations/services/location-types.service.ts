import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LocationType } from "../../../entities/LocationType";
import { User } from "../../../entities/User";
import { Status } from "../../../entities/Status";
import { UpdateLocationTypeDto } from "src/modules/locations/dto/UpdateLocationTypeDto";
import { CreateLocationTypeDto } from "src/modules/locations/dto/CreateLocationTypeDto";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import logger from "src/config/logger";

@Injectable()
export class LocationTypesService {
  constructor(
    @InjectRepository(LocationType)
    private locationTypeRepository: Repository<LocationType>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    private sseEventEmitter: SSEEventEmitterHelper,
  ) {}

  async findAll() {
    const locationTypes = await this.locationTypeRepository.find({
      relations: ["createdBy", "updatedBy", "status"],
    });

    return locationTypes.map((locationType) => ({
      id: locationType.id,
      location_type_name: locationType.location_type_name,
      status_id: locationType.status_id,
      created_at: locationType.created_at,
      created_by: locationType.created_by,
      updated_by: locationType.updated_by || null,
      modified_at: locationType.modified_at,
      created_user: locationType.createdBy
        ? `${locationType.createdBy.first_name} ${locationType.createdBy.last_name}`
        : null,
      updated_user: locationType.updatedBy
        ? `${locationType.updatedBy.first_name} ${locationType.updatedBy.last_name}`
        : null,
      status_name: locationType.status ? locationType.status.status_name : null,
    }));
  }

  async findOne(id: number) {
    const locationType = await this.locationTypeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!locationType) {
      throw new NotFoundException("Location type not found.");
    }

    return {
      id: locationType.id,
      location_type_name: locationType.location_type_name,
      status_id: locationType.status_id,
      created_at: locationType.created_at,
      created_by: locationType.created_by,
      updated_by: locationType.updated_by || null,
      modified_at: locationType.modified_at,
      created_user: locationType.createdBy
        ? `${locationType.createdBy.first_name} ${locationType.createdBy.last_name}`
        : null,
      updated_user: locationType.updatedBy
        ? `${locationType.updatedBy.first_name} ${locationType.updatedBy.last_name}`
        : null,
      status_name: locationType.status ? locationType.status.status_name : null,
    };
  }

  async create(createLocationTypeDto: CreateLocationTypeDto, userId: number) {
    const { location_type_name, status_id } = createLocationTypeDto;

    // Check if location type with this name already exists
    const existingLocationType = await this.locationTypeRepository.findOneBy({
      location_type_name,
    });
    if (existingLocationType) {
      throw new BadRequestException(
        "Location type with this name already exists.",
      );
    }

    // Find createdBy User entity
    const createdByUser = await this.userRepository.findOneBy({ id: userId });
    if (!createdByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }

    // Determine status_id: use provided status_id or default to 1 (active)
    const resolvedStatusId = status_id || 1;
    const statusEntity = await this.statusRepository.findOneBy({
      id: resolvedStatusId,
    });
    if (!statusEntity) {
      throw new BadRequestException(
        `Status with ID ${resolvedStatusId} not found.`,
      );
    }

    const locationType = new LocationType();
    locationType.location_type_name = location_type_name;
    locationType.status = statusEntity;
    locationType.status_id = statusEntity.id;
    locationType.createdBy = createdByUser;
    locationType.created_by = createdByUser.id;

    const savedLocationType =
      await this.locationTypeRepository.save(locationType);

    // Fetch complete data with relations
    const newLocationType = await this.locationTypeRepository.findOne({
      where: { id: savedLocationType.id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!newLocationType) {
      throw new Error("Failed to retrieve created location type");
    }

    // SSE Events
    try {
      this.sseEventEmitter.emitCreateSignal(
        "location_types",
        newLocationType.id,
      );
    } catch (err) {
      logger.error("SSE event failed:", err);
    }

    return {
      id: newLocationType.id,
      location_type_name: newLocationType.location_type_name,
      status_id: newLocationType.status_id,
      created_at: newLocationType.created_at,
      created_by: newLocationType.created_by,
      updated_by: newLocationType.updated_by || null,
      modified_at: newLocationType.modified_at,
      created_user: newLocationType.createdBy
        ? `${newLocationType.createdBy.first_name} ${newLocationType.createdBy.last_name}`
        : null,
      updated_user: newLocationType.updatedBy
        ? `${newLocationType.updatedBy.first_name} ${newLocationType.updatedBy.last_name}`
        : null,
      status_name: newLocationType.status
        ? newLocationType.status.status_name
        : null,
    };
  }

  async update(
    id: number,
    updateLocationTypeDto: UpdateLocationTypeDto,
    userId: number,
  ) {
    const { location_type_name, status_id } = updateLocationTypeDto;

    const locationTypeToUpdate = await this.locationTypeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!locationTypeToUpdate) {
      throw new NotFoundException("Location type not found for update.");
    }

    // Check for duplicate location_type_name if provided and different from current
    if (
      location_type_name &&
      location_type_name !== locationTypeToUpdate.location_type_name
    ) {
      const existingLocationType = await this.locationTypeRepository
        .createQueryBuilder("locationType")
        .where("locationType.location_type_name = :location_type_name", {
          location_type_name,
        })
        .andWhere("locationType.id != :id", { id })
        .getOne();
      if (existingLocationType) {
        throw new BadRequestException(
          "Location type with this name already exists.",
        );
      }
      locationTypeToUpdate.location_type_name = location_type_name;
    } else if (location_type_name !== undefined) {
      locationTypeToUpdate.location_type_name = location_type_name;
    }

    // Update status if provided
    if (status_id !== undefined) {
      const statusEntity = await this.statusRepository.findOneBy({
        id: status_id,
      });
      if (!statusEntity) {
        throw new BadRequestException(`Status with ID ${status_id} not found.`);
      }
      locationTypeToUpdate.status = statusEntity;
      locationTypeToUpdate.status_id = statusEntity.id;
    }

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    locationTypeToUpdate.updatedBy = updatedByUser;
    locationTypeToUpdate.updated_by = updatedByUser.id;

    const savedLocationType =
      await this.locationTypeRepository.save(locationTypeToUpdate);

    // Fetch complete data with relations
    const updatedLocationType = await this.locationTypeRepository.findOne({
      where: { id: savedLocationType.id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!updatedLocationType) {
      throw new Error("Failed to retrieve updated location type");
    }

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal(
        "location_types",
        updatedLocationType.id,
      );
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }

    return {
      id: updatedLocationType.id,
      location_type_name: updatedLocationType.location_type_name,
      status_id: updatedLocationType.status_id,
      created_at: updatedLocationType.created_at,
      created_by: updatedLocationType.created_by,
      updated_by: updatedLocationType.updated_by || null,
      modified_at: updatedLocationType.modified_at,
      created_user: updatedLocationType.createdBy
        ? `${updatedLocationType.createdBy.first_name} ${updatedLocationType.createdBy.last_name}`
        : null,
      updated_user: updatedLocationType.updatedBy
        ? `${updatedLocationType.updatedBy.first_name} ${updatedLocationType.updatedBy.last_name}`
        : null,
      status_name: updatedLocationType.status
        ? updatedLocationType.status.status_name
        : null,
    };
  }

  async remove(id: number) {
    const locationTypeToRemove = await this.locationTypeRepository.findOneBy({
      id,
    });

    if (!locationTypeToRemove) {
      throw new NotFoundException("Location type not found for deletion.");
    }

    await this.locationTypeRepository.remove(locationTypeToRemove);
    return { message: "Location type successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const locationTypeToUpdate = await this.locationTypeRepository.findOne({
      where: { id },
      relations: ["createdBy", "updatedBy", "status"],
    });

    if (!locationTypeToUpdate) {
      throw new NotFoundException("Location type not found for status toggle.");
    }

    // Determine new status_id
    let newStatusId: number;
    if (locationTypeToUpdate.status_id === 1) {
      newStatusId = 2; // Set to inactive
    } else if (locationTypeToUpdate.status_id === 2) {
      newStatusId = 1; // Set to active
    } else {
      newStatusId = 2; // Default to inactive
    }

    const newStatusEntity = await this.statusRepository.findOneBy({
      id: newStatusId,
    });
    if (!newStatusEntity) {
      throw new Error(
        "Target status (active/inactive) not found in the database.",
      );
    }

    locationTypeToUpdate.status = newStatusEntity;
    locationTypeToUpdate.status_id = newStatusEntity.id;

    // Set updatedBy user
    const updatedByUser = await this.userRepository.findOneBy({ id: userId });
    if (!updatedByUser) {
      throw new BadRequestException("Authenticated user not found.");
    }
    locationTypeToUpdate.updatedBy = updatedByUser;
    locationTypeToUpdate.updated_by = updatedByUser.id;

    const updatedLocationType =
      await this.locationTypeRepository.save(locationTypeToUpdate);

    const flattenedLocationType = {
      id: updatedLocationType.id,
      location_type_name: updatedLocationType.location_type_name,
      status_id: updatedLocationType.status_id,
      created_at: updatedLocationType.created_at,
      created_by: updatedLocationType.created_by,
      updated_by: updatedLocationType.updated_by || null,
      modified_at: updatedLocationType.modified_at,
      created_user: updatedLocationType.createdBy
        ? `${updatedLocationType.createdBy.first_name} ${updatedLocationType.createdBy.last_name}`
        : null,
      updated_user: updatedLocationType.updatedBy
        ? `${updatedLocationType.updatedBy.first_name} ${updatedLocationType.updatedBy.last_name}`
        : null,
      status_name: updatedLocationType.status
        ? updatedLocationType.status.status_name
        : null,
    };

    // SSE Events
    try {
      this.sseEventEmitter.emitUpdateSignal(
        "location_types",
        updatedLocationType.id,
      );
    } catch (err) {
      logger.error("SSE event failed for update:", err);
    }

    return {
      message: `Location type ${updatedLocationType.location_type_name} successfully toggled to ${newStatusEntity.status_name}.`,
      location_type: flattenedLocationType,
    };
  }
}
