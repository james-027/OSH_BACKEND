import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../entities/User";
import { Role } from "../entities/Role";
import { Status } from "../entities/Status";
import { Theme } from "../entities/Theme";
import { UserPermissions } from "../entities/UserPermissions";
import { UserLocations } from "../entities/UserLocations";
import { Module } from "../entities/Module";
import { Action } from "../entities/Action";
import { AccessKey } from "../entities/AccessKey";
import { Location } from "../entities/Location";
import { CreateUserDto } from "../dto/CreateUserDto";
import { UpdateUserDto } from "../dto/UpdateUserDto";
import logger from "../config/logger";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import { EmailService } from "./email.service";
import { SSEEventEmitterHelper } from "./sse-event-emitter.helper";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Status)
    private statusRepository: Repository<Status>,
    @InjectRepository(Theme)
    private themeRepository: Repository<Theme>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(UserLocations)
    private userLocationsRepository: Repository<UserLocations>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private emailService: EmailService,
    private sseEventEmitter: SSEEventEmitterHelper
  ) {}

  async findAll(): Promise<any[]> {
    try {
      const users = await this.usersRepository.find({
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });

      const flattenedUsers = await Promise.all(
        users.map((user) => this.createFlattenedResponse(user))
      );

      logger.info("Successfully retrieved all users.");
      return flattenedUsers;
    } catch (error) {
      logger.error("Error retrieving users:", error);
      throw new Error("Failed to retrieve users.");
    }
  }

  async findOne(id: number): Promise<any> {
    if (isNaN(id)) {
      throw new BadRequestException("Invalid user ID provided.");
    }

    try {
      const user = await this.usersRepository.findOne({
        where: { id },
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found.`);
      }

      const flattenedUser = await this.createFlattenedResponse(user);
      logger.info(`Successfully retrieved user with ID: ${id}`);
      return flattenedUser;
    } catch (error) {
      logger.error(`Error retrieving user with ID ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`Failed to retrieve user with ID ${id}.`);
    }
  }

  async findUsersBasic(filters?: {
    role_id?: number;
    status_id?: number;
    [key: string]: any;
  }): Promise<any[]> {
    try {
      const whereCondition: any = {};

      if (filters) {
        // Handle role_id filter
        if (filters.role_id !== undefined) {
          if (isNaN(filters.role_id)) {
            throw new BadRequestException("Invalid role ID provided.");
          }
          whereCondition.role_id = filters.role_id;
        }

        // Handle status_id filter
        if (filters.status_id !== undefined) {
          if (isNaN(filters.status_id)) {
            throw new BadRequestException("Invalid status ID provided.");
          }
          whereCondition.status_id = filters.status_id;
        }

        // Handle any other numeric filters dynamically
        Object.keys(filters).forEach((key) => {
          if (
            key !== "role_id" &&
            key !== "status_id" &&
            filters[key] !== undefined
          ) {
            if (typeof filters[key] === "number" && isNaN(filters[key])) {
              throw new BadRequestException(`Invalid ${key} provided.`);
            }
            whereCondition[key] = filters[key];
          }
        });
      }

      const users = await this.usersRepository.find({
        where: whereCondition,
        relations: ["role"],
        select: {
          id: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          role_id: true,
        },
      });

      const basicUsers = users.map((user) => ({
        id: user.id,
        full_name:
          `${user.first_name} ${user.middle_name || ""} ${user.last_name}`.trim(),
        role_name: user.role?.role_name || null,
      }));

      const filterDescription =
        filters && Object.keys(filters).length > 0
          ? ` with filters: ${JSON.stringify(filters)}`
          : "";

      logger.info(
        `Successfully retrieved ${basicUsers.length} users with basic info${filterDescription}.`
      );
      return basicUsers;
    } catch (error) {
      logger.error("Error retrieving users basic info:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to retrieve users basic info.");
    }
  }

  async nested(): Promise<any[]> {
    try {
      // Get all users with relations
      const users = await this.usersRepository.find({
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });

      // Create nested structure for all users
      const nestedData = await this.createNestedStructureForUsers(users);

      logger.info("Successfully retrieved all nested user data.");
      return nestedData;
    } catch (error) {
      logger.error("Error retrieving nested user data:", error);
      throw new Error(
        "Internal server error occurred while retrieving nested user data."
      );
    }
  }

  async nestedByUser(user_id: number): Promise<any> {
    if (isNaN(user_id)) {
      throw new BadRequestException("Invalid user ID provided.");
    }

    // Validate user exists
    const user = await this.usersRepository.findOne({
      where: { id: user_id },
      relations: [
        "role",
        "userUpline",
        "status",
        "theme",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    // Create nested structure for single user
    const nestedData = await this.createNestedStructureForUsers([user]);

    logger.info(
      `Successfully retrieved nested user data for user_id: ${user_id}.`
    );
    return nestedData[0] || null; // Return single user object or null
  }

  async nestedByUserAccessKey(user_id: number): Promise<any> {
    if (isNaN(user_id)) {
      throw new BadRequestException("Invalid user ID provided.");
    }

    // Validate user exists
    const user = await this.usersRepository.findOne({
      where: { id: user_id },
      relations: [
        "role",
        "userUpline",
        "status",
        "theme",
        "createdBy",
        "updatedBy",
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    // Create nested structure for single user
    const nestedData = await this.createNestedStructureForUsers([user], true);

    logger.info(
      `Successfully retrieved nested user data for user_id: ${user_id}.`
    );
    return nestedData[0] || null; // Return single user object or null
  }

  async test_email(
    email: string,
    first_name: string,
    last_name: string,
    password: string
  ): Promise<void> {
    if (email) {
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";
      const html = this.emailService.generateUserResetEmail({
        userName: `${first_name} ${last_name}`,
        email: email,
        password: password, // Only for first-time notification
      });
      await this.emailService.sendMail({
        to: email,
        subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
        html,
      });
    }
  }

  async send_reset_email(
    email: string,
    first_name: string,
    last_name: string,
    password: string,
    userId: number
  ): Promise<void> {
    if (email) {
      let emailStatus = "success";
      let emailError = null;
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";
      const subject = `${companyName} ${projectAbbr} - Your Account Credentials`;
      const html = this.emailService.generateUserResetEmail({
        userName: `${first_name} ${last_name}`,
        email: email,
        password: password, // Only for first-time notification
      });

      try {
        await this.emailService.sendMail({
          to: email,
          subject: subject,
          html,
        });
      } catch (emailErr) {
        emailStatus = "error";
        emailError = emailErr?.message || String(emailErr);
        // Optionally log email sending error, but do not fail the import
        logger.error(`Failed to send welcome email to ${email}:`, emailErr);
      }

      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: "send_reset_email",
          raw_data: JSON.stringify({
            to: email,
            subject: subject,
            html,
            status: emailStatus,
            error: emailError,
          }),
          description: `Reset email ${emailStatus} for user (${first_name} ${last_name})`,
          status_id: 1,
        },
        userId
      );
    }
  }

  async create(createUserDto: CreateUserDto): Promise<any> {
    const {
      user_name,
      first_name,
      middle_name,
      last_name,
      role_id,
      emp_number,
      email,
      password,
      user_reset,
      user_upline_id,
      email_switch,
      status_id,
      theme_id,
      profile_pic_url,
      access_key_id,
      user_permission_presets,
      location_ids,
      created_by,
    } = createUserDto;

    try {
      // Validate required fields
      if (!user_name || !first_name || !last_name || !role_id || !password) {
        throw new BadRequestException("Required fields are missing.");
      }

      // Check if user already exists
      const existingUser = await this.usersRepository.findOne({
        where: { user_name },
      });
      if (existingUser) {
        throw new BadRequestException(
          "User with this username already exists."
        );
      }

      // Check if email already exists (if provided)
      if (email) {
        const existingEmail = await this.usersRepository.findOne({
          where: { email },
        });
        if (existingEmail) {
          throw new BadRequestException("User with this email already exists.");
        }
      }

      // Validate role exists
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${role_id} not found.`);
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds); // Create new user
      const user = new User();
      user.user_name = user_name;
      user.first_name = first_name;
      user.middle_name = middle_name || null;
      user.last_name = last_name;
      user.role_id = role_id;
      user.emp_number = emp_number || null;
      user.email = email || null;
      user.password = hashedPassword;
      user.user_reset = user_reset;
      user.user_upline_id = user_upline_id || null;
      user.email_switch = email_switch;
      user.status_id = status_id;
      user.theme_id = theme_id;
      user.profile_pic_url =
        profile_pic_url || "/uploads/profile_pics/default_profile.jpg";
      user.created_by = created_by;

      // Set current_access_key to the first access key if provided
      if (access_key_id && access_key_id.length > 0) {
        user.current_access_key = access_key_id[0];
      }

      const savedUser = await this.usersRepository.save(user);

      // Create UserPermissions if provided
      if (access_key_id && user_permission_presets) {
        await this.createUserPermissions(
          savedUser.id,
          role_id,
          access_key_id,
          user_permission_presets,
          created_by
        );
      }

      // Create UserLocations if provided
      if (location_ids) {
        await this.createUserLocations(
          savedUser.id,
          role_id,
          location_ids,
          created_by
        );
      }

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: "create",
          raw_data: JSON.stringify(savedUser),
          description: `Created user ${savedUser.id} - ${savedUser.user_name} | ${savedUser.first_name} ${savedUser.last_name}`,
          status_id: 1,
        },
        savedUser.created_by
      );

      logger.info(`User created successfully with ID: ${savedUser.id}`);

      // Send email notification to user
      if (savedUser.email) {
        const companyName = process.env.COMPANY_NAME || "CTGI";
        const projectName = process.env.PROJECT_NAME || "Success Perks Awards";
        const projectAbbr = process.env.PROJECT_ABBR || "SPA";
        const html = this.emailService.generateUserWelcomeEmail({
          userName: `${savedUser.first_name} ${savedUser.last_name}`,
          email: savedUser.email,
          password: password,
        });
        let emailStatus = "success";
        let emailError = null;
        try {
          await this.emailService.sendMail({
            to: savedUser.email,
            subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
            html,
          });
        } catch (emailErr) {
          emailStatus = "error";
          emailError = emailErr?.message || String(emailErr);
          logger.error(
            `Failed to send welcome email to ${savedUser.email}:`,
            emailErr
          );
        }
        // Audit trail for email sending (success or error)
        await this.userAuditTrailCreateService.create(
          {
            service: "UsersService",
            method: "create:sendMail",
            raw_data: JSON.stringify({
              to: savedUser.email,
              subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
              html,
              status: emailStatus,
              error: emailError,
            }),
            description: `Welcome email ${emailStatus} for user (id ${savedUser.id})`,
            status_id: 1,
          },
          savedUser.created_by
        );
      }

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitCreateSignal("users", savedUser.id);
      } catch (err) {
        console.warn("SSE event failed:", err);
      }

      return this.createFlattenedResponse(savedUser);
    } catch (error) {
      logger.error("Error creating user:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new Error("Failed to create user.");
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<any> {
    if (isNaN(id)) {
      throw new BadRequestException("Invalid user ID provided for update.");
    }

    const {
      // User fields
      user_name,
      first_name,
      middle_name,
      last_name,
      role_id,
      emp_number,
      email,
      password,
      user_reset,
      user_upline_id,
      email_switch,
      status_id,
      theme_id,
      profile_pic_url,
      // UserPermissions fields
      access_key_id,
      user_permission_presets,
      // UserLocations fields
      location_ids,
      // Audit field
      updated_by,
    } = updateUserDto;

    try {
      const userToUpdate = await this.usersRepository.findOne({
        where: { id },
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });

      if (!userToUpdate) {
        throw new NotFoundException("User not found for update.");
      }

      // Validate permissions data if provided
      if (access_key_id && user_permission_presets) {
        // Validate access keys exist
        for (const accessKeyId of access_key_id) {
          const accessKey = await this.accessKeyRepository.findOne({
            where: { id: accessKeyId },
          });
          if (!accessKey) {
            throw new BadRequestException(
              `Access key with ID ${accessKeyId} not found`
            );
          }
        }

        // Validate all modules and actions exist
        for (const preset of user_permission_presets) {
          const module = await this.moduleRepository.findOne({
            where: { id: preset.module_ids },
          });
          if (!module) {
            throw new BadRequestException(
              `Module with ID ${preset.module_ids} not found`
            );
          }
          for (const actionId of preset.action_ids) {
            const action = await this.actionRepository.findOne({
              where: { id: actionId },
            });
            if (!action) {
              throw new BadRequestException(
                `Action with ID ${actionId} not found`
              );
            }
          }
        }
      }

      // Validate locations data if provided
      if (location_ids) {
        for (const locationId of location_ids) {
          const location = await this.locationRepository.findOne({
            where: { id: locationId },
          });
          if (!location) {
            throw new BadRequestException(
              `Location with ID ${locationId} not found`
            );
          }
        }
      }

      // Update fields if provided
      if (user_name !== undefined) {
        if (user_name !== userToUpdate.user_name) {
          const existingUser = await this.usersRepository.findOne({
            where: { user_name },
          });
          if (existingUser && existingUser.id !== id) {
            throw new BadRequestException(
              "User with this username already exists."
            );
          }
        }
        userToUpdate.user_name = user_name;
      }

      if (email !== undefined) {
        if (email && email !== userToUpdate.email) {
          const existingEmail = await this.usersRepository.findOne({
            where: { email },
          });
          if (existingEmail && existingEmail.id !== id) {
            throw new BadRequestException(
              "User with this email already exists."
            );
          }
        }
        userToUpdate.email = email;
      }

      // Update other fields
      if (first_name !== undefined) userToUpdate.first_name = first_name;
      if (middle_name !== undefined) userToUpdate.middle_name = middle_name;
      if (last_name !== undefined) userToUpdate.last_name = last_name;
      if (role_id !== undefined) {
        userToUpdate.role_id = role_id;
        // Also update the relation to ensure TypeORM persists the change
        userToUpdate.role = await this.roleRepository.findOne({
          where: { id: role_id },
        });
      }
      if (emp_number !== undefined) userToUpdate.emp_number = emp_number;
      if (user_reset !== undefined) userToUpdate.user_reset = user_reset;
      if (user_upline_id !== undefined)
        userToUpdate.user_upline_id = user_upline_id;
      if (email_switch !== undefined) userToUpdate.email_switch = email_switch;
      if (status_id !== undefined) userToUpdate.status_id = status_id;
      if (theme_id !== undefined) userToUpdate.theme_id = theme_id;
      if (profile_pic_url !== undefined)
        userToUpdate.profile_pic_url = profile_pic_url;

      // Hash new password if provided
      if (password) {
        const saltRounds = 10;
        userToUpdate.password = await bcrypt.hash(password, saltRounds);
      }

      userToUpdate.updated_by = updated_by;

      // Save user before updating permissions/locations so role_id is up-to-date
      const savedUser = await this.usersRepository.save(userToUpdate);

      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: "update",
          raw_data: JSON.stringify(userToUpdate),
          description: `Updated user ${id} - ${userToUpdate.user_name} | ${userToUpdate.first_name} ${userToUpdate.last_name}`,
          status_id: 1,
        },
        updateUserDto.updated_by
      );

      // Handle UserPermissions updates if provided
      let permissionsMessage = "";
      if (access_key_id && user_permission_presets) {
        // First, mark all existing permissions for this user as inactive (status_id = 2)
        await this.userPermissionsRepository.update(
          { user_id: id },
          {
            status_id: 2, // inactive
            updated_by: updated_by,
            modified_at: new Date(),
          }
        );

        const updatedPermissions: any[] = [];
        const createdPermissions: any[] = [];

        // Get the final role_id and status_id to use
        const finalRoleId =
          role_id !== undefined ? role_id : userToUpdate.role_id;
        const finalStatusId = 1; // active status for new/updated permissions

        // Iterate through access keys first
        for (const accessKeyId of access_key_id) {
          // Then iterate through permission presets
          for (const preset of user_permission_presets) {
            // Then iterate through each action in the preset
            for (const actionId of preset.action_ids) {
              // Check if this combination already exists
              const existingPermission =
                await this.userPermissionsRepository.findOne({
                  where: {
                    user_id: id,
                    role_id: finalRoleId,
                    module_id: preset.module_ids,
                    action_id: actionId,
                    access_key_id: accessKeyId,
                  },
                });

              if (existingPermission) {
                // Update existing permission back to active status
                existingPermission.status_id = finalStatusId;
                existingPermission.updated_by = updated_by;
                existingPermission.modified_at = new Date();
                const savedPermission =
                  await this.userPermissionsRepository.save(existingPermission);
                updatedPermissions.push(savedPermission);
              } else {
                // Create new permission with active status
                const userPermission = this.userPermissionsRepository.create({
                  user_id: id,
                  role_id: finalRoleId,
                  module_id: preset.module_ids,
                  action_id: actionId,
                  access_key_id: accessKeyId,
                  status_id: finalStatusId,
                  created_by: updated_by,
                });
                const savedPermission =
                  await this.userPermissionsRepository.save(userPermission);
                createdPermissions.push(savedPermission);
              }
            }
          }
        }

        permissionsMessage = ` Updated ${updatedPermissions.length} existing permission(s) and created ${createdPermissions.length} new permission(s).`;
      }

      // Handle UserLocations updates if provided
      let locationsMessage = "";
      if (location_ids) {
        // First, mark all existing locations for this user as inactive (status_id = 2)
        await this.userLocationsRepository.update(
          { user_id: id },
          {
            status_id: 2, // inactive
            updated_by: updated_by,
            modified_at: new Date(),
          }
        );

        const updatedLocations: any[] = [];
        const createdLocations: any[] = [];

        // Get the final role_id to use
        const finalRoleId =
          role_id !== undefined ? role_id : userToUpdate.role_id;
        const finalStatusId = 1; // active status for new/updated locations

        // Iterate through location IDs
        for (const locationId of location_ids) {
          // Check if this combination already exists
          const existingLocation = await this.userLocationsRepository.findOne({
            where: {
              user_id: id,
              role_id: finalRoleId,
              location_id: locationId,
            },
          });

          if (existingLocation) {
            // Update existing location back to active status
            existingLocation.status_id = finalStatusId;
            existingLocation.updated_by = updated_by;
            existingLocation.modified_at = new Date();
            const savedLocation =
              await this.userLocationsRepository.save(existingLocation);
            updatedLocations.push(savedLocation);
          } else {
            // Create new location with active status
            const userLocation = this.userLocationsRepository.create({
              user_id: id,
              role_id: finalRoleId,
              location_id: locationId,
              status_id: finalStatusId,
              created_by: updated_by,
            });
            const savedLocation =
              await this.userLocationsRepository.save(userLocation);
            createdLocations.push(savedLocation);
          }
        }

        locationsMessage = ` Updated ${updatedLocations.length} existing location(s) and created ${createdLocations.length} new location(s).`;
      }

      // Fetch updated user with relations
      const updatedUser = await this.usersRepository.findOne({
        where: { id: savedUser.id },
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });

      const responseMessage = `Successfully updated user with ID ${id}.${permissionsMessage}${locationsMessage}`;

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitUpdateSignal("users", savedUser.id);
      } catch (err) {
        console.warn("SSE event failed for update:", err);
      }

      logger.info(`User updated successfully with ID: ${id}`);
      return {
        message: responseMessage,
        user: await this.createFlattenedResponse(updatedUser!),
      };
    } catch (error) {
      logger.error(`Error updating user with ID ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`Failed to update user with ID ${id}.`);
    }
  }

  async remove(id: number): Promise<any> {
    if (isNaN(id)) {
      throw new BadRequestException("Invalid user ID provided for deletion.");
    }

    try {
      const userToRemove = await this.usersRepository.findOne({
        where: { id },
      });

      if (!userToRemove) {
        throw new NotFoundException("User not found for deletion.");
      }

      await this.usersRepository.remove(userToRemove);

      // Emit SSE event for user deletion (broadcast to all users)
      try {
        this.sseEventEmitter.emitDelete("users", id);
      } catch (sseError) {
        logger.warn("SSE event emission failed for user deletion:", sseError);
      }

      logger.info(`User deleted successfully with ID: ${id}`);
      return { message: "User successfully deleted." };
    } catch (error) {
      logger.error(`Error deleting user with ID ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`Failed to delete user with ID ${id}.`);
    }
  }

  async toggleStatus(id: number, authenticatedUserId: number): Promise<any> {
    if (isNaN(id)) {
      throw new BadRequestException(
        "Invalid user ID provided for status toggle."
      );
    }

    try {
      const user = await this.usersRepository.findOne({
        where: { id },
        relations: ["status"],
      });

      if (!user) {
        throw new NotFoundException("User not found.");
      }

      // Get user ID from token
      const userId = authenticatedUserId;
      if (!userId) {
        throw new UnauthorizedException("User not authenticated.");
      }

      // Find active and inactive status IDs
      const activeStatus = await this.statusRepository.findOne({
        where: { status_name: "ACTIVE" },
      });
      const inactiveStatus = await this.statusRepository.findOne({
        where: { status_name: "INACTIVE" },
      });

      if (!activeStatus || !inactiveStatus) {
        throw new BadRequestException("Required status records not found.");
      } // Toggle status
      const newStatusId =
        user.status_id === activeStatus.id
          ? inactiveStatus.id
          : activeStatus.id;

      const newStatusName =
        newStatusId === activeStatus.id ? "ACTIVE" : "INACTIVE";

      // Determine which status entity to use for the update
      const newStatusEntity =
        newStatusId === activeStatus.id ? activeStatus : inactiveStatus;

      // Update User status
      user.status_id = newStatusId;
      user.status = newStatusEntity; // Update the status relation object as well
      user.updated_by = userId;
      user.modified_at = new Date();

      const updatedUser = await this.usersRepository.save(user);

      // Update all UserPermissions for this user
      const permissionsUpdateResult =
        await this.userPermissionsRepository.update(
          { user_id: id },
          {
            status_id: newStatusId,
            updated_by: userId,
            modified_at: new Date(),
          }
        );

      // Update all UserLocations for this user
      const locationsUpdateResult = await this.userLocationsRepository.update(
        { user_id: id },
        {
          status_id: newStatusId,
          updated_by: userId,
          modified_at: new Date(),
        }
      );

      // Fetch the updated user with relations for flattened response
      const userWithRelations = await this.usersRepository.findOne({
        where: { id: updatedUser.id },
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
        ],
      });
      const flattenedUser = await this.createFlattenedResponse(
        userWithRelations!
      );
      // Audit trail
      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: "toggleStatus",
          raw_data: JSON.stringify(flattenedUser),
          description: `Toggled status for user ${id} to ${newStatusName} by user ${userId}`,
          status_id: 1,
        },
        authenticatedUserId
      );

      const statusText =
        newStatusId === activeStatus.id ? "active" : "inactive";

      const responseMessage =
        `Successfully toggled status to ${statusText} for user ID ${id}. ` +
        `Updated ${
          permissionsUpdateResult.affected || 0
        } user permission(s) and ` +
        `${locationsUpdateResult.affected || 0} user location(s).`;

      let response = {
        message: responseMessage,
        user: flattenedUser,
        affected_records: {
          user: 1,
          permissions: permissionsUpdateResult.affected || 0,
          locations: locationsUpdateResult.affected || 0,
        },
        new_status: newStatusId,
      };
      logger.info(
        `Successfully toggled status for user with ID ${id} and all related records.`
      );

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitUpdateSignal("users", id);
      } catch (err) {
        console.warn("SSE event failed for update:", err);
      }
      return response;
    } catch (error) {
      logger.error(`Error toggling status for user with ID ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(`Failed to toggle status for user with ID ${id}.`);
    }
  }

  // Helper method to create user permissions
  private async createUserPermissions(
    userId: number,
    roleId: number,
    accessKeyIds: number[],
    userPermissionPresets: any[],
    createdBy: number
  ): Promise<void> {
    for (const accessKeyId of accessKeyIds) {
      for (const preset of userPermissionPresets) {
        for (const actionId of preset.action_ids) {
          // Check if this combination already exists
          const existingPermission =
            await this.userPermissionsRepository.findOne({
              where: {
                user_id: userId,
                role_id: roleId,
                module_id: preset.module_ids,
                action_id: actionId,
                access_key_id: accessKeyId,
              },
            });

          if (!existingPermission) {
            const userPermission = this.userPermissionsRepository.create({
              user_id: userId,
              role_id: roleId,
              module_id: preset.module_ids,
              action_id: actionId,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: createdBy,
            });

            await this.userPermissionsRepository.save(userPermission);
          }
        }
      }
    }
  }

  // Helper method to create user locations
  private async createUserLocations(
    userId: number,
    roleId: number,
    locationIds: number[],
    createdBy: number
  ): Promise<void> {
    for (const locationId of locationIds) {
      // Check if this combination already exists
      const existingLocation = await this.userLocationsRepository.findOne({
        where: {
          user_id: userId,
          role_id: roleId,
          location_id: locationId,
        },
      });

      if (!existingLocation) {
        const userLocation = this.userLocationsRepository.create({
          user_id: userId,
          role_id: roleId,
          location_id: locationId,
          status_id: 1,
          created_by: createdBy,
        });

        await this.userLocationsRepository.save(userLocation);
      }
    }
  }

  // Helper method to create flattened response with merged permissions and locations
  private async createFlattenedResponse(user: User): Promise<any> {
    // Get user permissions for this user
    const userPermissions = await this.userPermissionsRepository.find({
      where: { user_id: user.id },
      relations: [
        "module",
        "action",
        "accessKey",
        "status",
        "createdBy",
        "updatedBy",
      ],
    });

    // Extract unique module names
    const moduleNames = Array.from(
      new Set(
        userPermissions
          .map((up) => (up.module ? up.module.module_name : null))
          .filter(Boolean)
      )
    );

    // Extract unique action names
    const actionNames = Array.from(
      new Set(
        userPermissions
          .map((up) => (up.action ? up.action.action_name : null))
          .filter(Boolean)
      )
    );

    // Get user locations for this user
    const userLocations = await this.userLocationsRepository.find({
      where: { user_id: user.id },
      relations: ["location", "status"],
    });

    // Extract unique location names
    const locationNames = Array.from(
      new Set(
        userLocations
          .map((ul) => (ul.location ? ul.location.location_name : null))
          .filter(Boolean)
      )
    );

    // Build flattened response
    return {
      id: user.id,
      user_name: user.user_name,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      full_name:
        `${user.first_name} ${user.middle_name || ""} ${user.last_name}`.trim(),
      role_id: user.role_id,
      emp_number: user.emp_number,
      email: user.email,
      user_reset: user.user_reset,
      user_upline_id: user.user_upline_id,
      email_switch: user.email_switch,
      status_id: user.status_id,
      theme_id: user.theme_id,
      profile_pic_url: user.profile_pic_url,
      created_at: user.created_at,
      created_by: user.created_by,
      updated_by: user.updated_by,
      modified_at: user.modified_at,
      current_access_key: user.current_access_key,
      role_name: user.role?.role_name || null,
      role_level: user.role?.role_level || null,
      user_upline_name: user.userUpline
        ? `${user.userUpline.first_name} ${user.userUpline.last_name}`
        : null,
      status_name: user.status?.status_name || null,
      theme_name: user.theme?.theme_name || null,
      created_user: user.createdBy
        ? `${user.createdBy.first_name} ${user.createdBy.last_name}`
        : null,
      updated_user: user.updatedBy
        ? `${user.updatedBy.first_name} ${user.updatedBy.last_name}`
        : null,
      // user_permissions: userPermissions.map((permission) => ({
      //   id: permission.id,
      //   user_id: permission.user_id,
      //   role_id: permission.role_id,
      //   module_id: permission.module_id,
      //   action_id: permission.action_id,
      //   access_key_id: permission.access_key_id,
      //   status_id: permission.status_id,
      //   created_at: permission.created_at,
      //   created_by: permission.created_by,
      //   updated_by: permission.updated_by || null,
      //   modified_at: permission.modified_at,
      //   module_name: permission.module?.module_name || null,
      //   action_name: permission.action?.action_name || null,
      //   access_key_name: permission.accessKey?.access_key_name || null,
      //   permission_status_name: permission.status?.status_name || null,
      //   created_user: permission.createdBy
      //     ? `${permission.createdBy.first_name} ${permission.createdBy.last_name}`
      //     : null,
      //   updated_user: permission.updatedBy
      //     ? `${permission.updatedBy.first_name} ${permission.updatedBy.last_name}`
      //     : null,
      // })),
      // user_locations: userLocations.map((userLocation) => ({
      //   id: userLocation.id,
      //   user_id: userLocation.user_id,
      //   role_id: userLocation.role_id,
      //   location_id: userLocation.location_id,
      //   status_id: userLocation.status_id,
      //   created_at: userLocation.created_at,
      //   created_by: userLocation.created_by,
      //   updated_by: userLocation.updated_by || null,
      //   modified_at: userLocation.modified_at,
      //   location_name: userLocation.location?.location_name || null,
      //   location_status_name: userLocation.status?.status_name || null,
      // })),
      module_name: moduleNames,
      action_name: actionNames,
      location_name: locationNames,
    };
  }

  // Helper method to create nested structure from users with permissions and locations
  private async createNestedStructureForUsers(
    users: User[],
    perAccessKey: boolean = false
  ): Promise<any[]> {
    const nestedUsers = [];

    for (const user of users) {
      let wherePermissions: any = { user_id: user.id, status_id: 1 };
      if (perAccessKey) {
        wherePermissions.access_key_id = user.current_access_key;
      }
      // Get user permissions for this user
      const userPermissions = await this.userPermissionsRepository.find({
        where: wherePermissions,
        relations: [
          "module",
          "action",
          "accessKey",
          "status",
          "createdBy",
          "updatedBy",
        ],
      });

      // Get user locations for this user
      const userLocations = await this.userLocationsRepository.find({
        where: { user_id: user.id, role_id: user.role_id, status_id: 1 },
        relations: ["location", "status"],
      });

      // Group permissions by module and nest actions within modules
      const moduleMap = new Map<number, any>();
      // Collect unique access keys for this user
      const accessKeyMap = new Map<number, any>();

      userPermissions.forEach((permission) => {
        // Collect access key information
        if (
          permission.accessKey &&
          !accessKeyMap.has(permission.access_key_id)
        ) {
          accessKeyMap.set(permission.access_key_id, {
            id: permission.accessKey.id,
            access_key_name: permission.accessKey.access_key_name,
            status_id: permission.accessKey.status_id,
            user_access_key_status_id: permission.status_id,
          });
        }

        if (permission.module) {
          const moduleId = permission.module.id;

          if (!moduleMap.has(moduleId)) {
            moduleMap.set(moduleId, {
              id: permission.module.id,
              module_name: permission.module.module_name,
              module_alias: permission.module.module_alias,
              module_link: permission.module.module_link,
              menu_title: permission.module.menu_title,
              parent_title: permission.module.parent_title,
              link_name: permission.module.link_name,
              order_level: permission.module.order_level,
              status_id: permission.module.status_id,
              created_at: permission.module.created_at,
              modified_at: permission.module.modified_at,
              actions: [], // Initialize actions array for each module
            });
          }

          const module = moduleMap.get(moduleId);

          // Add action to the module's actions array (if not already present)
          if (
            permission.action &&
            !module.actions.find((a: any) => a.id === permission.action.id)
          ) {
            module.actions.push({
              id: permission.action.id,
              action_name: permission.action.action_name,
              status_id: permission.action.status_id,
              permission_status_id: permission.status_id,
            });
          }
        }
      });

      // Get the current access key name if current_access_key exists
      const currentAccessKeyName = user.current_access_key
        ? Array.from(accessKeyMap.values()).find(
            (ak) => ak.id === user.current_access_key
          )?.access_key_name || null
        : null;

      // Create the nested user object
      const nestedUser = {
        user_id: user.id,
        user: {
          id: user.id,
          user_name: user.user_name,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          full_name: `${user.first_name} ${user.middle_name || ""} ${
            user.last_name
          }`.trim(),
          emp_number: user.emp_number,
          email: user.email,
          user_reset: user.user_reset,
          user_upline_id: user.user_upline_id,
          email_switch: user.email_switch,
          profile_pic_url: user.profile_pic_url,
          current_access_key: user.current_access_key,
          current_access_key_name: currentAccessKeyName,
          created_at: user.created_at,
          modified_at: user.modified_at,
        },
        role: user.role
          ? {
              id: user.role.id,
              role_name: user.role.role_name,
              role_level: user.role.role_level,
              status_id: user.role.status_id,
            }
          : null,
        access_keys: Array.from(accessKeyMap.values()),
        modules: Array.from(moduleMap.values()),
        locations: userLocations.map((ul) => ({
          id: ul.location?.id || null,
          location_name: ul.location?.location_name || null,
          status_id: ul.location?.status_id || null,
          user_location_status_id: ul.status_id,
        })),
        user_upline: user.userUpline
          ? {
              id: user.userUpline.id,
              user_name: user.userUpline.user_name,
              first_name: user.userUpline.first_name,
              last_name: user.userUpline.last_name,
              full_name: `${user.userUpline.first_name} ${user.userUpline.last_name}`,
            }
          : null,
        theme: user.theme
          ? {
              id: user.theme.id,
              theme_name: user.theme.theme_name,
              status_id: user.theme.status_id,
            }
          : null,
        status: {
          id: user.status?.id || null,
          status_name: user.status?.status_name || null,
        },
        created_by: {
          id: user.createdBy?.id || null,
          user_name: user.createdBy?.user_name || null,
          first_name: user.createdBy?.first_name || null,
          last_name: user.createdBy?.last_name || null,
          full_name: user.createdBy
            ? `${user.createdBy.first_name} ${user.createdBy.last_name}`
            : null,
        },
        updated_by: user.updatedBy
          ? {
              id: user.updatedBy.id,
              user_name: user.updatedBy.user_name,
              first_name: user.updatedBy.first_name,
              last_name: user.updatedBy.last_name,
              full_name: `${user.updatedBy.first_name} ${user.updatedBy.last_name}`,
            }
          : null,
        created_at: user.created_at,
        modified_at: user.modified_at,
      };

      nestedUsers.push(nestedUser);
    }
    return nestedUsers;
  }

  /**
   * Helper method to find a user by ID for use by other services
   */
  async findUserById(id: number): Promise<User | null> {
    try {
      return await this.usersRepository.findOneBy({ id });
    } catch (error) {
      logger.error(`Error finding user with ID ${id}:`, error);
      return null;
    }
  }

  async uploadExcelUsers(
    filePath: string,
    created_by: number,
    role_id: number,
    role_level: number
  ): Promise<any> {
    const XLSX = require("xlsx");
    const fs = require("fs");
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const results = [];
    const inserted_row_numbers: number[] = [];
    const updated_row_numbers: number[] = [];
    const errors: { row: number; error: string }[] = [];
    const success: any[] = [];
    let inserted_count = 0;
    let updated_count = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = row["__rowNum__"] || i + 2; // Excel row number (header + 1-based)
      try {
        // Validation: required fields
        const required = [
          "Username",
          "Employee No.",
          "First Name",
          "Last Name",
          "Email",
          "Password",
          "Access Keys",
          "Role",
        ];
        for (const field of required) {
          if (!row[field] || String(row[field]).trim() === "") {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        // 1. Lookup access keys (comma separated abbr)
        const accessKeyAbbrs = String(row["Access Keys"] || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const accessKeys = await this.accessKeyRepository.find({
          where: accessKeyAbbrs.length
            ? accessKeyAbbrs.map((abbr) => ({ access_key_abbr: abbr }))
            : undefined,
        });
        if (accessKeys.length !== accessKeyAbbrs.length) {
          throw new Error(
            "Some Access Keys not found: " + accessKeyAbbrs.join(", ")
          );
        }
        // 2. Lookup role
        const role = await this.roleRepository.findOne({
          where: {
            role_name: row["Role"],
            // role_level: MoreThanOrEqual(role_level),
          },
        });
        if (!role) throw new Error("Role not found: " + row["Role"]);
        if (role.role_level < role_level) {
          throw new Error(
            "Role level too low: " +
              row["Role"] +
              " requires level " +
              role.role_level +
              ". Your Role level hierarchy is only: " +
              role_level
          );
        }
        // 3. Lookup role_action_preset and role_location_preset
        const roleActionPresets = await this.usersRepository.manager
          .getRepository("RoleActionPreset")
          .find({ where: { role_id: role.id, status_id: 1 } });

        // Check if Location(s) column has values
        let locationIds: number[] = [];
        let useRoleLocationPresets = true;

        if (row["Location(s)"] && String(row["Location(s)"]).trim() !== "") {
          try {
            // Parse comma-separated location names
            const locationNames = String(row["Location(s)"])
              .split(",")
              .map((name: string) => name.trim())
              .filter(Boolean);

            // Look up locations by name
            const locations = await this.locationRepository.find({
              where: locationNames.map((name) => ({ location_name: name })),
            });

            // Check if at least one location was found
            if (locations.length > 0) {
              // At least one location found, use the ones that were found
              locationIds = locations.map((loc) => loc.id);
              useRoleLocationPresets = false;

              // Log any locations that weren't found
              if (locations.length < locationNames.length) {
                const foundNames = locations.map((loc) => loc.location_name);
                const notFound = locationNames.filter(
                  (name) => !foundNames.includes(name)
                );
                logger.warn(
                  `Some locations not found: ${notFound.join(", ")}. Using only the matched locations.`
                );
              }
            } else {
              // No locations found at all, log the issue and fall back to presets
              logger.warn(
                `No locations matched from: ${locationNames.join(", ")}. Falling back to role location presets.`
              );
            }
          } catch (locError) {
            logger.warn(
              `Error processing location names: ${locError.message}. Falling back to role location presets.`
            );
          }
        }

        // If no locations specified or any error in location lookup, use role location presets
        if (useRoleLocationPresets) {
          const roleLocationPresets = await this.usersRepository.manager
            .getRepository("RoleLocationPreset")
            .find({ where: { role_id: role.id, status_id: 1 } });
          locationIds = roleLocationPresets.map((preset) => preset.location_id);
        }

        // 4. Check if user already exists (by user_name or email)
        let existingUser = await this.usersRepository.findOne({
          where: [{ user_name: row["Username"] }, { email: row["Email"] }],
        });
        // Check for duplicate employee number (emp_number)
        if (row["Employee No."]) {
          const existingEmpNumber = await this.usersRepository.findOne({
            where: { emp_number: row["Employee No."] },
          });
          if (
            existingEmpNumber &&
            (!existingUser || existingEmpNumber.id !== existingUser.id)
          ) {
            errors.push({
              row: rowNum,
              error: `Duplicate Employee No.: ${row["Employee No."]} already exists`,
            });
            continue;
          }
        }
        if (existingUser) {
          // Update logic (identical to update method, no deletion)
          const updateUserDto: any = {
            user_name: row["Username"],
            emp_number: row["Employee No."],
            first_name: row["First Name"],
            last_name: row["Last Name"],
            middle_name: row["Middle Name"],
            email: row["Email"],
            password: row["Password"],
            current_access_key: accessKeys[0]?.id,
            role_id: role.id,
            status_id: 1,
            updated_by: created_by,
            user_reset: row["User Reset"] || false,
            theme_id: row["Theme ID"] || 1,
            // Permissions/locations
            access_key_id: accessKeys.map((k) => k.id),
            user_permission_presets: roleActionPresets.map((preset) => ({
              module_ids: preset.module_id,
              action_ids: [preset.action_id],
            })),
            location_ids: locationIds,
          };
          await this.update(existingUser.id, updateUserDto);
          // Audit trail for update
          await this.userAuditTrailCreateService.create(
            {
              service: "UsersService",
              method: "uploadExcelUsers",
              raw_data: JSON.stringify({ row, updateUserDto }),
              description: `User updated via Excel upload (row ${rowNum})`,
              status_id: 1,
            },
            created_by
          );
          updated_count++;
          updated_row_numbers.push(rowNum);
          success.push({ ...row, __rowNum__: rowNum });
        } else {
          // Create logic
          const user = this.usersRepository.create({
            user_name: row["Username"],
            emp_number: row["Employee No."],
            first_name: row["First Name"],
            last_name: row["Last Name"],
            middle_name: row["Middle Name"],
            email: row["Email"],
            password: await bcrypt.hash(row["Password"], 10),
            current_access_key: accessKeys[0]?.id, // for main access key
            role_id: role.id,
            status_id: 1,
            user_reset: true, // default to true on create
            user_upline_id: row["User Upline ID"] || null,
            theme_id: row["Theme ID"] || 1,
            profile_pic_url: "/uploads/profile_pics/default_profile.jpg",
            created_by,
          });
          const savedUser = await this.usersRepository.save(user);
          // Audit trail for insert
          await this.userAuditTrailCreateService.create(
            {
              service: "UsersService",
              method: "uploadExcelUsers",
              raw_data: JSON.stringify({ row, user: savedUser }),
              description: `User created via Excel upload (row ${rowNum})`,
              status_id: 1,
            },
            created_by
          );
          // Create user_permissions for all access keys
          for (const accessKey of accessKeys) {
            for (const preset of roleActionPresets) {
              await this.userPermissionsRepository.save({
                user_id: savedUser.id,
                role_id: role.id,
                module_id: preset.module_id,
                action_id: preset.action_id,
                access_key_id: accessKey.id,
                status_id: 1,
                created_by,
              });
            }
          }
          // Create user_locations ONCE per location
          const uniqueLocationIds = Array.from(new Set(locationIds));
          for (const locationId of uniqueLocationIds) {
            await this.userLocationsRepository.save({
              user_id: savedUser.id,
              role_id: role.id,
              location_id: locationId,
              status_id: 1,
              created_by,
            });
          }
          inserted_count++;
          // Send email notification to user
          if (savedUser.email) {
            const companyName = process.env.COMPANY_NAME || "CTGI";
            const projectName =
              process.env.PROJECT_NAME || "Success Perks Awards";
            const projectAbbr = process.env.PROJECT_ABBR || "SPA";
            const html = this.emailService.generateUserWelcomeEmail({
              userName: `${savedUser.first_name} ${savedUser.last_name}`,
              email: savedUser.email,
              password: row["Password"],
            });
            let emailStatus = "success";
            let emailError = null;
            try {
              await this.emailService.sendMail({
                to: savedUser.email,
                subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
                html,
              });
            } catch (emailErr) {
              emailStatus = "error";
              emailError = emailErr?.message || String(emailErr);
              // Optionally log email sending error, but do not fail the import
              logger.error(
                `Failed to send welcome email to ${savedUser.email}:`,
                emailErr
              );
            }
            // Audit trail for email sending (success or error)
            await this.userAuditTrailCreateService.create(
              {
                service: "UsersService",
                method: "uploadExcelUsers:sendMail",
                raw_data: JSON.stringify({
                  to: savedUser.email,
                  subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
                  html,
                  status: emailStatus,
                  error: emailError,
                }),
                description: `Welcome email ${emailStatus} for user (row ${rowNum})`,
                status_id: 1,
              },
              created_by
            );
          }
          inserted_row_numbers.push(rowNum);
          success.push({ ...row, __rowNum__: rowNum });
        }
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
      }
    }
    return {
      inserted_count,
      updated_count,
      inserted_row_numbers,
      updated_row_numbers,
      errors,
      success,
    };
  }
}
