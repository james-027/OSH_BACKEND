import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserLocations } from "../../../entities/UserLocations";
import { User } from "../../../entities/User";
import { Role } from "../../../entities/Role";
import { Location } from "../../../entities/Location";
import { Status } from "../../../entities/Status";
import { UpdateUserLocationsDto } from "src/modules/users/dto/UpdateUserLocationsDto";
import { CreateUserLocationsDto } from "src/modules/users/dto/CreateUserLocationsDto";

@Injectable()
export class UserLocationsService {
  constructor(
    @InjectRepository(UserLocations)
    private userLocationsRepository: Repository<UserLocations>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
  ) {}

  async findAll() {
    const userLocations = await this.userLocationsRepository.find({
      relations: [
        "user",
        "role",
        "location",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    // Group by user_id and role_id combination
    const groupedLocations = userLocations.reduce((acc, userLocation) => {
      const key = `${userLocation.user_id}_${userLocation.role_id}`;

      if (!acc[key]) {
        acc[key] = {
          id: userLocation.id, // Use the first record's ID as representative
          user_id: userLocation.user_id,
          user_full_name: userLocation.user
            ? `${userLocation.user.first_name} ${userLocation.user.last_name}`
            : null,
          role_id: userLocation.role_id,
          role_name: userLocation.role ? userLocation.role.role_name : null,
          location_id: [],
          location_name: [],
          status_id: userLocation.status_id,
          created_at: userLocation.created_at,
          created_by: userLocation.created_by,
          updated_by: userLocation.updated_by || null,
          modified_at: userLocation.modified_at,
          created_user: userLocation.createdBy
            ? `${userLocation.createdBy.first_name} ${userLocation.createdBy.last_name}`
            : null,
          updated_user: userLocation.updatedBy
            ? `${userLocation.updatedBy.first_name} ${userLocation.updatedBy.last_name}`
            : null,
          status_name: userLocation.status
            ? userLocation.status.status_name
            : null,
        };
      }

      // Add location data to arrays
      acc[key].location_id.push(userLocation.location_id);
      acc[key].location_name.push(
        userLocation.location ? userLocation.location.location_name : null,
      );

      return acc;
    }, {} as any);

    return Object.values(groupedLocations);
  }

  async findOne(id: number) {
    const userLocation = await this.userLocationsRepository.findOne({
      where: { id },
      relations: [
        "user",
        "role",
        "location",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!userLocation) {
      throw new NotFoundException(`User location with ID ${id} not found`);
    }

    // Find all locations for this user and role combination
    const allUserLocations = await this.userLocationsRepository.find({
      where: {
        user_id: userLocation.user_id,
        role_id: userLocation.role_id,
      },
      relations: ["location"],
    });

    return {
      id: userLocation.id,
      user_id: userLocation.user_id,
      user_full_name: userLocation.user
        ? `${userLocation.user.first_name} ${userLocation.user.last_name}`
        : null,
      role_id: userLocation.role_id,
      role_name: userLocation.role ? userLocation.role.role_name : null,
      location_id: allUserLocations.map((ul) => ul.location_id),
      location_name: allUserLocations.map((ul) =>
        ul.location ? ul.location.location_name : null,
      ),
      status_id: userLocation.status_id,
      created_at: userLocation.created_at,
      created_by: userLocation.created_by,
      updated_by: userLocation.updated_by || null,
      modified_at: userLocation.modified_at,
      created_user: userLocation.createdBy
        ? `${userLocation.createdBy.first_name} ${userLocation.createdBy.last_name}`
        : null,
      updated_user: userLocation.updatedBy
        ? `${userLocation.updatedBy.first_name} ${userLocation.updatedBy.last_name}`
        : null,
      status_name: userLocation.status ? userLocation.status.status_name : null,
    };
  }

  async create(createUserLocationsDto: CreateUserLocationsDto, userId: number) {
    const {
      user_id,
      role_id,
      location_ids,
      status_id = 1,
    } = createUserLocationsDto;

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: user_id } });
    if (!user) {
      throw new BadRequestException(`User with ID ${user_id} not found`);
    }

    // Validate role exists
    const role = await this.roleRepository.findOne({ where: { id: role_id } });
    if (!role) {
      throw new BadRequestException(`Role with ID ${role_id} not found`);
    }

    // Validate all locations exist
    for (const locationId of location_ids) {
      const location = await this.locationRepository.findOne({
        where: { id: locationId },
      });
      if (!location) {
        throw new BadRequestException(
          `Location with ID ${locationId} not found`,
        );
      }
    }

    const createdLocations: any[] = [];
    const skippedLocations: any[] = [];

    // Iterate through location IDs
    for (const locationId of location_ids) {
      // Check if this combination already exists
      const existingLocation = await this.userLocationsRepository.findOne({
        where: {
          user_id,
          role_id,
          location_id: locationId,
        },
      });

      if (existingLocation) {
        // Skip this combination as it already exists
        skippedLocations.push({
          user_id,
          role_id,
          location_id: locationId,
          reason: "Combination already exists",
        });
        continue;
      }

      const userLocation = this.userLocationsRepository.create({
        user_id,
        role_id,
        location_id: locationId,
        status_id,
        created_by: userId,
      });

      const savedLocation =
        await this.userLocationsRepository.save(userLocation);
      createdLocations.push(savedLocation);
    }

    // Fetch all created locations with relations for response
    const locationsWithRelations = await this.userLocationsRepository.find({
      where: { user_id, role_id },
      relations: ["user", "role", "location", "status", "createdBy"],
    });

    // Group the response in flattened format
    const flattenedResponse = {
      id: locationsWithRelations[0]?.id || null,
      user_id,
      user_full_name: locationsWithRelations[0]?.user
        ? `${locationsWithRelations[0].user.first_name} ${locationsWithRelations[0].user.last_name}`
        : null,
      role_id,
      role_name: locationsWithRelations[0]?.role
        ? locationsWithRelations[0].role.role_name
        : null,
      location_id: locationsWithRelations.map((ul) => ul.location_id),
      location_name: locationsWithRelations.map((ul) =>
        ul.location ? ul.location.location_name : null,
      ),
      status_id,
      created_at: locationsWithRelations[0]?.created_at || null,
      created_by: userId,
      updated_by: null,
      modified_at: locationsWithRelations[0]?.modified_at || null,
      created_user: locationsWithRelations[0]?.createdBy
        ? `${locationsWithRelations[0].createdBy.first_name} ${locationsWithRelations[0].createdBy.last_name}`
        : null,
      updated_user: null,
      status_name: locationsWithRelations[0]?.status
        ? locationsWithRelations[0].status.status_name
        : null,
    };

    const responseMessage =
      skippedLocations.length > 0
        ? `Created ${createdLocations.length} user location(s) successfully. Skipped ${skippedLocations.length} duplicate combinations.`
        : `Created ${createdLocations.length} user location(s) successfully`;

    return {
      message: responseMessage,
      data: flattenedResponse,
      skipped: skippedLocations.length > 0 ? skippedLocations : undefined,
    };
  }

  async update(
    id: number,
    updateUserLocationsDto: UpdateUserLocationsDto,
    userId: number,
  ) {
    const { location_ids, role_id, user_id, status_id } =
      updateUserLocationsDto;

    const userLocationToUpdate = await this.userLocationsRepository.findOne({
      where: { id },
      relations: [
        "user",
        "role",
        "location",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!userLocationToUpdate) {
      throw new NotFoundException("User location not found for update.");
    }

    // If location_ids are provided, we need to update the entire set for this user-role combination
    if (location_ids && Array.isArray(location_ids)) {
      // First, remove all existing locations for this user-role combination
      await this.userLocationsRepository.delete({
        user_id: userLocationToUpdate.user_id,
        role_id: userLocationToUpdate.role_id,
      });

      // Then create new ones
      const createdLocations: any[] = [];
      for (const locationId of location_ids) {
        const location = await this.locationRepository.findOne({
          where: { id: locationId },
        });
        if (!location) {
          throw new BadRequestException(
            `Location with ID ${locationId} not found`,
          );
        }

        const userLocation = this.userLocationsRepository.create({
          user_id: userLocationToUpdate.user_id,
          role_id: userLocationToUpdate.role_id,
          location_id: locationId,
          status_id: status_id || userLocationToUpdate.status_id,
          created_by: userLocationToUpdate.created_by,
          updated_by: userId,
        });

        const savedLocation =
          await this.userLocationsRepository.save(userLocation);
        createdLocations.push(savedLocation);
      }
    } else if (status_id !== undefined) {
      // Just update status for all records of this user-role combination
      await this.userLocationsRepository.update(
        {
          user_id: userLocationToUpdate.user_id,
          role_id: userLocationToUpdate.role_id,
        },
        {
          status_id,
          updated_by: userId,
        },
      );
    }

    // Return updated data
    return this.findOne(id);
  }

  async remove(id: number) {
    const userLocationToRemove = await this.userLocationsRepository.findOneBy({
      id,
    });

    if (!userLocationToRemove) {
      throw new NotFoundException("User location not found for deletion.");
    }

    await this.userLocationsRepository.remove(userLocationToRemove);
    return { message: "User location successfully deleted." };
  }

  async toggleStatus(id: number, userId: number) {
    const userLocationToUpdate = await this.userLocationsRepository.findOne({
      where: { id },
      relations: [
        "user",
        "role",
        "location",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!userLocationToUpdate) {
      throw new NotFoundException("User location not found for status toggle.");
    }

    // Determine new status_id
    let newStatusId: number;
    if (userLocationToUpdate.status_id === 1) {
      newStatusId = 2; // Set to inactive
    } else if (userLocationToUpdate.status_id === 2) {
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

    // Update all records for this user-role combination
    await this.userLocationsRepository.update(
      {
        user_id: userLocationToUpdate.user_id,
        role_id: userLocationToUpdate.role_id,
      },
      {
        status_id: newStatusId,
        updated_by: userId,
      },
    );

    // Return updated data
    const updatedUserLocation = await this.findOne(id);

    return {
      message: `User location status successfully toggled to ${newStatusEntity.status_name}.`,
      user_location: updatedUserLocation,
    };
  }
}
