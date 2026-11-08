import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  MoreThanOrEqual,
  In,
  DataSource,
  QueryRunner,
} from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../../../entities/User";
import { Role } from "../../../entities/Role";
import { Status } from "../../../entities/Status";
import { Theme } from "../../../entities/Theme";
import { UserPermissions } from "../../../entities/UserPermissions";
import { UserLocations } from "../../../entities/UserLocations";
import { Module } from "../../../entities/Module";
import { Action } from "../../../entities/Action";
import { AccessKey } from "../../../entities/AccessKey";
import { Location } from "../../../entities/Location";
import { CreateUserDto } from "../dto/CreateUserDto";
import { UpdateUserDto } from "../dto/UpdateUserDto";
import logger from "../../../config/logger";
import { UserAuditTrailCreateService } from "./user-audit-trail-create.service";
import { CreateUserAuditTrailDto } from "../dto/CreateUserAuditTrailDto";
import { EmailService } from "../../../services/email.service";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { FrontendUrlUtil } from "../../../utils/frontend-url.util";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";
import {
  validateAndFormatExcelRow,
  ExcelValidationConfig,
} from "../../../utils/excel-validation";

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
    private dataSource: DataSource,
    private userAuditTrailCreateService: UserAuditTrailCreateService,
    private emailService: EmailService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private frontendUrlUtil: FrontendUrlUtil,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

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
        users.map((user) => this.createFlattenedResponse(user)),
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
        `Successfully retrieved ${basicUsers.length} users with basic info${filterDescription}.`,
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

  async findUsersByRoleInUserPermission(filters?: {
    role_id?: number;
    status_id?: number;
    [key: string]: any;
  }): Promise<any[]> {
    try {
      // Build query with group by for optimal performance
      let query = this.userPermissionsRepository
        .createQueryBuilder("up")
        .leftJoinAndSelect("up.role", "role")
        .leftJoinAndSelect("up.user", "user")
        .select("up.user_id", "user_id")
        .addSelect("user.first_name", "first_name")
        .addSelect("user.middle_name", "middle_name")
        .addSelect("user.last_name", "last_name")
        .addSelect("role.role_name", "role_name")
        .groupBy("up.user_id");

      // Apply filters to WHERE clause before GROUP BY
      if (filters) {
        // Handle role_id filter
        if (filters.role_id !== undefined) {
          if (isNaN(filters.role_id)) {
            throw new BadRequestException("Invalid role ID provided.");
          }
          query = query.andWhere("up.role_id = :role_id", {
            role_id: filters.role_id,
          });
        }

        // Handle status_id filter
        if (filters.status_id !== undefined) {
          if (isNaN(filters.status_id)) {
            throw new BadRequestException("Invalid status ID provided.");
          }
          query = query.andWhere("up.status_id = :status_id", {
            status_id: filters.status_id,
          });
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
            query = query.andWhere(`up.${key} = :${key}`, {
              [key]: filters[key],
            });
          }
        });
      }

      const results = await query.getRawMany();

      const basicUsers = results.map((row) => ({
        id: row.user_id,
        full_name:
          `${row.first_name} ${row.middle_name || ""} ${row.last_name}`.trim(),
        role_name: row.role_name || null,
      }));

      const filterDescription =
        filters && Object.keys(filters).length > 0
          ? ` with filters: ${JSON.stringify(filters)}`
          : "";

      logger.info(
        `Successfully retrieved ${basicUsers.length} unique users with basic info${filterDescription}.`,
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

  async findUsersByRolesAndLocations(body: {
    role_ids: number[];
    location_ids?: number[];
    status_id?: number;
  }): Promise<any[]> {
    try {
      const { role_ids = [], location_ids = [], status_id = 1 } = body;

      if (!Array.isArray(role_ids) || role_ids.length === 0) {
        return [];
      }

      let query = this.userPermissionsRepository
        .createQueryBuilder("up")
        .leftJoin("up.user", "user")
        .leftJoin("up.role", "role")
        .select("user.id", "id")
        .addSelect("user.first_name", "first_name")
        .addSelect("user.middle_name", "middle_name")
        .addSelect("user.last_name", "last_name")
        .addSelect("user.user_name", "user_name")
        .addSelect("user.emp_number", "emp_number")
        .addSelect(
          "GROUP_CONCAT(DISTINCT role.role_name SEPARATOR ', ')",
          "role_name",
        )
        .where("up.role_id IN (:...role_ids)", { role_ids })
        .andWhere("up.status_id = :status_id", { status_id })
        .andWhere("user.status_id = 1");

      // If location_ids filter is provided and not empty
      if (Array.isArray(location_ids) && location_ids.length > 0) {
        query = query.andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select("ul.user_id")
            .from("user_locations", "ul")
            .where("ul.location_id IN (:...location_ids)", { location_ids })
            .andWhere("ul.status_id = :status_id", { status_id })
            .getQuery();
          return `up.user_id IN ${subQuery}`;
        });
      }

      query = query
        .groupBy("user.id")
        .addGroupBy("user.first_name")
        .addGroupBy("user.middle_name")
        .addGroupBy("user.last_name")
        .addGroupBy("user.user_name")
        .addGroupBy("user.emp_number")
        .orderBy("user.last_name", "ASC")
        .addOrderBy("user.first_name", "ASC");

      const rawResults = await query.getRawMany();

      return rawResults.map((row) => ({
        id: row.id,
        user_name: row.user_name,
        emp_number: row.emp_number,
        full_name:
          `${row.last_name}, ${row.first_name}${row.middle_name ? ` ${row.middle_name}` : ""}`.trim(),
        role_name: row.role_name || "",
      }));
    } catch (error) {
      logger.error("Error retrieving users by roles and locations:", error);
      throw error;
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
      const nestedData = await this.createNestedStructureForUsers(
        users,
        false,
        false,
      );

      logger.info("Successfully retrieved all nested user data.");
      return nestedData;
    } catch (error) {
      logger.error("Error retrieving nested user data:", error);
      throw new Error(
        "Internal server error occurred while retrieving nested user data.",
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
        "role.system",
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    // Create nested structure for single user
    const nestedData = await this.createNestedStructureForUsers(
      [user],
      false,
      true,
      false,
      false,
    );

    logger.info(
      `Successfully retrieved nested user data for user_id: ${user_id}.`,
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
        "role.system",
      ],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${user_id} not found.`);
    }

    // Create nested structure for single user
    const nestedData = await this.createNestedStructureForUsers([user], true);

    logger.info(
      `Successfully retrieved nested user data for user_id: ${user_id}.`,
    );
    return nestedData[0] || null; // Return single user object or null
  }

  async testEmail(
    email: string,
    first_name: string,
    last_name: string,
    password: string,
    request?: any,
  ): Promise<void> {
    if (email) {
      const loginUrl = this.frontendUrlUtil.getFrontendUrlFromRequest(request);
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";
      const html = this.emailService.generateUserResetEmail({
        userName: `${first_name} ${last_name}`,
        email: email,
        password: password,
        loginUrl,
      });
      await this.emailService.sendMail({
        to: email,
        subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
        html,
      });
    }
  }

  async viewEmailTemplate(
    email: string,
    first_name: string,
    last_name: string,
    password: string,
    request?: any,
  ): Promise<string> {
    if (email) {
      // logger.log("request basis:", request);
      const loginUrl = this.frontendUrlUtil.getFrontendUrlFromRequest(request);
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";
      const html = this.emailService.generateUserResetEmail({
        userName: `${first_name} ${last_name}`,
        email: email,
        password: password,
        loginUrl,
      });

      return html;
    }
  }

  async sendResetEmail(
    email: string,
    first_name: string,
    last_name: string,
    password: string,
    userId: number,
    request?: any,
    selfService?: boolean,
  ): Promise<void> {
    if (email) {
      const selfServiceText = selfService ? " (Self-Service)" : "";
      let emailStatus = "success";
      let emailError = null;
      const loginUrl = this.frontendUrlUtil.getFrontendUrlFromRequest(request);
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";
      const subject = `${companyName} ${projectAbbr} - Your Account Credentials`;
      const html = this.emailService.generateUserResetEmail({
        userName: `${first_name} ${last_name}`,
        email: email,
        password: password,
        loginUrl,
      }); // Only for first-time notification

      try {
        await this.emailService.sendMail({
          to: email,
          subject: subject,
          html,
        });
      } catch (emailErr) {
        emailStatus = "error";
        emailError = this.getErrorMessage(emailErr);
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
          description: `${selfServiceText} Reset email ${emailStatus} for user (${first_name} ${last_name})`,
          status_id: 1,
        },
        userId,
      );
    }
  }

  async create(createUserDto: CreateUserDto, request?: any): Promise<any> {
    const {
      user_name,
      first_name,
      middle_name,
      last_name,
      role_id,
      role_ids,
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
      user_location_presets,
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
          "User with this username already exists.",
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

      // Validate default role exists
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });
      if (!role) {
        throw new BadRequestException(`Role with ID ${role_id} not found.`);
      }

      // Validate all roles in role_ids exist if provided
      const allRoleIds = role_ids && role_ids.length > 0 ? role_ids : [role_id];
      const rolesMap = new Map<number, Role>();
      for (const rId of allRoleIds) {
        const foundRole = await this.roleRepository.findOne({
          where: { id: rId },
        });
        if (!foundRole) {
          throw new BadRequestException(`Role with ID ${rId} not found.`);
        }
        rolesMap.set(rId, foundRole);
      }

      // Validate access keys exist if provided
      const accessKeys: AccessKey[] = [];
      if (access_key_id && access_key_id.length > 0) {
        for (const akId of access_key_id) {
          const ak = await this.accessKeyRepository.findOne({
            where: { id: akId },
          });
          if (!ak) {
            throw new BadRequestException(
              `Access key with ID ${akId} not found`,
            );
          }
          accessKeys.push(ak);
        }
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user with default role_id
      const user = new User();
      user.user_name = user_name;
      user.first_name = first_name.toUpperCase();
      user.middle_name = middle_name ? middle_name.toUpperCase() : null;
      user.last_name = last_name.toUpperCase();
      user.role_id = role_id; // Default role
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
      if (accessKeys.length > 0) {
        user.current_access_key = accessKeys[0].id;
      }

      const savedUser = await this.usersRepository.save(user);

      // Create UserPermissions from presets if provided
      if (
        accessKeys.length > 0 &&
        user_permission_presets &&
        user_permission_presets.length > 0
      ) {
        await this.createUserPermissionsFromPresets(
          savedUser.id,
          accessKeys.map((ak) => ak.id),
          user_permission_presets,
          created_by,
        );
      }

      // Create UserLocations from presets or fallback to location_ids
      if (user_location_presets && user_location_presets.length > 0) {
        await this.createUserLocationsFromPresets(
          savedUser.id,
          accessKeys.map((ak) => ak.id),
          user_location_presets,
          created_by,
        );
      } else if (location_ids && location_ids.length > 0) {
        await this.createUserLocationsForMultipleRoles(
          savedUser.id,
          allRoleIds,
          location_ids,
          created_by,
          accessKeys.map((ak) => ak.id),
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
        savedUser.created_by,
      );

      logger.info(`User created successfully with ID: ${savedUser.id}`);

      // Send email notification to user
      if (savedUser.email) {
        await this.sendUserWelcomeEmail(
          savedUser,
          password,
          0,
          created_by,
          request,
        );
      }

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitCreateSignal("users", savedUser.id);
        this.sseEventEmitter.emitCreateSignal("users", 0);
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.warn("SSE event failed:", err);
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

  // Helper method to create/update user permissions from presets with multiple access keys
  private async createUserPermissionsFromPresets(
    userId: number,
    accessKeyIds: number[],
    userPermissionPresets: any[],
    updatedBy: number,
    rolesToUpdate?: number[],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.userPermissionsRepository.manager;

    // Determine which roles are targeted for update
    const targetRoleIds =
      rolesToUpdate && rolesToUpdate.length > 0
        ? rolesToUpdate
        : Array.from(
            new Set(
              userPermissionPresets
                .map((p) => p.role_id)
                .filter((r): r is number => typeof r === "number" && r > 0),
            ),
          );

    if (targetRoleIds.length === 0) return;

    // Step 1: Mark ONLY existing permissions for the targeted roles as inactive (status_id = 2)
    await manager.update(
      UserPermissions,
      { user_id: userId, role_id: In(targetRoleIds) },
      {
        status_id: 2, // inactive
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // Step 2: Fetch all existing permissions for these targeted roles in 1 fast query
    const existingPerms = await manager.find(UserPermissions, {
      where: { user_id: userId, role_id: In(targetRoleIds) },
    });

    const permMap = new Map<string, UserPermissions>();
    existingPerms.forEach((p) => {
      permMap.set(
        `${p.role_id}_${p.access_key_id}_${p.module_id}_${p.action_id}`,
        p,
      );
    });

    // Step 3: Fast in-memory reconciliation
    const toSave: UserPermissions[] = [];
    const seen = new Set<string>();

    for (const preset of userPermissionPresets) {
      const roleId = preset.role_id;
      if (!targetRoleIds.includes(roleId)) continue; // Skip untouched roles!

      const moduleId = preset.module_ids;
      const actionIds = preset.action_ids;
      if (!Array.isArray(actionIds)) continue;

      // Use preset's specific access_key_id if present; fallback to accessKeyIds
      const keysForPreset = preset.access_key_id
        ? [preset.access_key_id]
        : accessKeyIds;

      for (const akId of keysForPreset) {
        for (const actionId of actionIds) {
          const key = `${roleId}_${akId}_${moduleId}_${actionId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const existing = permMap.get(key);
          if (existing) {
            existing.status_id = 1;
            existing.updated_by = updatedBy;
            existing.modified_at = new Date();
            toSave.push(existing);
          } else {
            const newPerm = manager.create(UserPermissions, {
              user_id: userId,
              role_id: roleId,
              module_id: moduleId,
              action_id: actionId,
              access_key_id: akId,
              status_id: 1,
              created_by: updatedBy,
            });
            toSave.push(newPerm);
          }
        }
      }
    }

    // Step 4: Batch save in chunks of 250 for optimal execution speed
    if (toSave.length > 0) {
      await manager.save(UserPermissions, toSave, { chunk: 250 });
    }
  }

  // Helper method to create/update user locations from location presets (per role and access key)
  private async createUserLocationsFromPresets(
    userId: number,
    accessKeyIds: number[],
    userLocationPresets: any[],
    updatedBy: number,
    rolesToUpdate?: number[],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.userLocationsRepository.manager;

    // Collect all relevant access key IDs (from presets or user access keys)
    const presetAccessKeys = userLocationPresets
      .map((p) => p.access_key_id)
      .filter((id): id is number => typeof id === "number" && id > 0);
    const targetAccessKeyIds = Array.from(
      new Set(
        presetAccessKeys.length > 0
          ? presetAccessKeys
          : accessKeyIds && accessKeyIds.length > 0
            ? accessKeyIds
            : [1],
      ),
    );

    // Determine target roles to update
    const targetRoleIds =
      rolesToUpdate && rolesToUpdate.length > 0
        ? rolesToUpdate
        : Array.from(
            new Set(
              userLocationPresets
                .map((p) => p.role_id)
                .filter((r): r is number => typeof r === "number" && r > 0),
            ),
          );

    if (targetRoleIds.length === 0) return;

    // Step 1: Mark existing locations for this user ONLY within target roles & access keys as inactive
    await manager.update(
      UserLocations,
      {
        user_id: userId,
        role_id: In(targetRoleIds),
        access_key_id: In(targetAccessKeyIds),
      },
      {
        status_id: 2, // inactive
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // Step 2: Validate unique location IDs across all presets in 1 query
    const uniqueLocationIds = Array.from(
      new Set(
        userLocationPresets.flatMap((preset) => preset.location_ids || []),
      ),
    ).filter((id): id is number => typeof id === "number" && id > 0);

    if (uniqueLocationIds.length > 0) {
      const foundLocations = await this.locationRepository.findBy({
        id: In(uniqueLocationIds),
      });
      if (foundLocations.length !== uniqueLocationIds.length) {
        const foundSet = new Set(foundLocations.map((l) => l.id));
        const missing = uniqueLocationIds.find((id) => !foundSet.has(id));
        throw new BadRequestException(`Location with ID ${missing} not found`);
      }
    }

    // Step 3: Fetch existing locations for target roles & keys in one query
    const existingLocs = await manager.find(UserLocations, {
      where: {
        user_id: userId,
        role_id: In(targetRoleIds),
        access_key_id: In(targetAccessKeyIds),
      },
    });

    const locMap = new Map<string, UserLocations>();
    existingLocs.forEach((el) => {
      locMap.set(`${el.role_id}_${el.access_key_id}_${el.location_id}`, el);
    });

    // Step 4: Fast in-memory reconciliation
    const toSaveLocs: UserLocations[] = [];
    const seenLocs = new Set<string>();

    for (const preset of userLocationPresets) {
      const roleId = preset.role_id;
      if (!targetRoleIds.includes(roleId)) continue; // Skip untouched roles!

      const locationIds = preset.location_ids || [];
      const keysForThisPreset = preset.access_key_id
        ? [preset.access_key_id]
        : targetAccessKeyIds;

      if (!Array.isArray(locationIds)) continue;

      for (const accessKeyId of keysForThisPreset) {
        for (const locationId of locationIds) {
          const key = `${roleId}_${accessKeyId}_${locationId}`;
          if (seenLocs.has(key)) continue;
          seenLocs.add(key);

          const existingLocation = locMap.get(key);
          if (existingLocation) {
            existingLocation.status_id = 1;
            existingLocation.updated_by = updatedBy;
            existingLocation.modified_at = new Date();
            toSaveLocs.push(existingLocation);
          } else {
            const userLocation = manager.create(UserLocations, {
              user_id: userId,
              role_id: roleId,
              location_id: locationId,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: updatedBy,
            });
            toSaveLocs.push(userLocation);
          }
        }
      }
    }

    // Step 5: Batch save in chunks of 250
    if (toSaveLocs.length > 0) {
      await manager.save(UserLocations, toSaveLocs, { chunk: 250 });
    }
  }

  // Helper method to create/update user locations for multiple roles
  private async createUserLocationsForMultipleRoles(
    userId: number,
    roleIds: number[],
    locationIds: number[],
    updatedBy: number,
    accessKeyIds: number[] = [1],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner
      ? queryRunner.manager
      : this.userLocationsRepository.manager;

    const targetKeys =
      accessKeyIds && accessKeyIds.length > 0 ? accessKeyIds : [1];

    // Step 1: Mark all existing locations within target access keys as inactive
    await manager.update(
      UserLocations,
      { user_id: userId, access_key_id: In(targetKeys) },
      {
        status_id: 2, // inactive
        updated_by: updatedBy,
        modified_at: new Date(),
      },
    );

    // Step 2: Fetch existing locations in 1 query
    const existingLocations = await manager.find(UserLocations, {
      where: {
        user_id: userId,
        role_id: In(roleIds),
        access_key_id: In(targetKeys),
      },
    });

    const locMap = new Map<string, UserLocations>();
    existingLocations.forEach((el) => {
      locMap.set(`${el.role_id}_${el.access_key_id}_${el.location_id}`, el);
    });

    const toSave: UserLocations[] = [];
    const seen = new Set<string>();

    for (const accessKeyId of targetKeys) {
      for (const roleId of roleIds) {
        for (const locationId of locationIds) {
          const key = `${roleId}_${accessKeyId}_${locationId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const existingLocation = locMap.get(key);
          if (existingLocation) {
            existingLocation.status_id = 1;
            existingLocation.updated_by = updatedBy;
            existingLocation.modified_at = new Date();
            toSave.push(existingLocation);
          } else {
            const userLocation = manager.create(UserLocations, {
              user_id: userId,
              role_id: roleId,
              location_id: locationId,
              access_key_id: accessKeyId,
              status_id: 1,
              created_by: updatedBy,
            });
            toSave.push(userLocation);
          }
        }
      }
    }

    if (toSave.length > 0) {
      await manager.save(UserLocations, toSave, { chunk: 250 });
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
      role_ids,
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
      user_location_presets,
      // Selective update
      roles_to_update,
      // Audit field
      updated_by,
    } = updateUserDto;

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

    // Fast validation for permissions data if provided
    if (
      access_key_id &&
      user_permission_presets &&
      user_permission_presets.length > 0
    ) {
      const akIds = Array.from(new Set(access_key_id));
      const foundAks = await this.accessKeyRepository.findBy({ id: In(akIds) });
      if (foundAks.length !== akIds.length) {
        const foundSet = new Set(foundAks.map((k) => k.id));
        const missing = akIds.find((k) => !foundSet.has(k));
        throw new BadRequestException(
          `Access key with ID ${missing} not found`,
        );
      }

      const allModuleIds = Array.from(
        new Set(
          user_permission_presets.map((p) => p.module_ids).filter(Boolean),
        ),
      );
      if (allModuleIds.length > 0) {
        const foundModules = await this.moduleRepository.findBy({
          id: In(allModuleIds),
        });
        if (foundModules.length !== allModuleIds.length) {
          const foundSet = new Set(foundModules.map((m) => m.id));
          const missing = allModuleIds.find((mid) => !foundSet.has(mid));
          throw new BadRequestException(`Module with ID ${missing} not found`);
        }
      }

      const allActionIds = Array.from(
        new Set(
          user_permission_presets
            .flatMap((p) => p.action_ids || [])
            .filter(Boolean),
        ),
      );
      if (allActionIds.length > 0) {
        const foundActions = await this.actionRepository.findBy({
          id: In(allActionIds),
        });
        if (foundActions.length !== allActionIds.length) {
          const foundSet = new Set(foundActions.map((a) => a.id));
          const missing = allActionIds.find((aid) => !foundSet.has(aid));
          throw new BadRequestException(`Action with ID ${missing} not found`);
        }
      }
    }

    // Fast validation for locations data if provided
    if (location_ids && location_ids.length > 0) {
      const uniqueLocIds = Array.from(new Set(location_ids));
      const foundLocs = await this.locationRepository.findBy({
        id: In(uniqueLocIds),
      });
      if (foundLocs.length !== uniqueLocIds.length) {
        const foundSet = new Set(foundLocs.map((l) => l.id));
        const missing = uniqueLocIds.find((lid) => !foundSet.has(lid));
        throw new BadRequestException(`Location with ID ${missing} not found`);
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
            "User with this username already exists.",
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
          throw new BadRequestException("User with this email already exists.");
        }
      }
      userToUpdate.email = email;
    }

    // Update other fields
    if (first_name !== undefined && first_name) {
      userToUpdate.first_name = String(first_name).toUpperCase();
    }
    if (middle_name !== undefined && middle_name) {
      userToUpdate.middle_name = String(middle_name).toUpperCase();
    } else if (middle_name === null || middle_name === "") {
      userToUpdate.middle_name = null; // Allow clearing middle name
    }
    if (last_name !== undefined && last_name) {
      userToUpdate.last_name = String(last_name).toUpperCase();
    }
    if (role_id !== undefined) {
      userToUpdate.role_id = role_id;
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

    // Determine if permissions and locations should be updated
    // If roles_to_update is provided as an empty array, SKIP updating permissions/locations completely!
    const shouldUpdatePermissions =
      (roles_to_update !== undefined && roles_to_update.length > 0) ||
      (roles_to_update === undefined && user_permission_presets !== undefined);

    let permissionsMessage = "";
    let locationsMessage = "";
    let savedUserId = id;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Save user inside transaction
      const savedUser = await queryRunner.manager.save(User, userToUpdate);
      savedUserId = savedUser.id;

      // 2. Update permissions if requested
      if (
        shouldUpdatePermissions &&
        access_key_id &&
        user_permission_presets &&
        user_permission_presets.length > 0
      ) {
        await this.createUserPermissionsFromPresets(
          id,
          access_key_id,
          user_permission_presets,
          updated_by,
          roles_to_update,
          queryRunner,
        );

        const activePermissions = await queryRunner.manager.count(
          UserPermissions,
          {
            where: { user_id: id, status_id: 1 },
          },
        );
        permissionsMessage = ` Updated/created ${activePermissions} permission(s).`;
      }

      // 3. Update locations if requested
      const effectiveAccessKeyIds =
        access_key_id && access_key_id.length > 0
          ? access_key_id
          : userToUpdate.userPermissions?.map((up) => up.access_key_id) || [];

      if (
        shouldUpdatePermissions &&
        user_location_presets &&
        user_location_presets.length > 0
      ) {
        await this.createUserLocationsFromPresets(
          id,
          effectiveAccessKeyIds,
          user_location_presets,
          updated_by,
          roles_to_update,
          queryRunner,
        );

        const activeLocations = await queryRunner.manager.count(UserLocations, {
          where: { user_id: id, status_id: 1 },
        });
        locationsMessage = ` Updated/created ${activeLocations} location(s).`;
      } else if (
        shouldUpdatePermissions &&
        location_ids &&
        location_ids.length > 0
      ) {
        const allRoleIds =
          roles_to_update && roles_to_update.length > 0
            ? roles_to_update
            : role_ids && role_ids.length > 0
              ? role_ids
              : [role_id || userToUpdate.role_id];

        await this.createUserLocationsForMultipleRoles(
          id,
          allRoleIds,
          location_ids,
          updated_by,
          effectiveAccessKeyIds,
          queryRunner,
        );

        const activeLocations = await queryRunner.manager.count(UserLocations, {
          where: { user_id: id, status_id: 1 },
        });
        locationsMessage = ` Updated/created ${activeLocations} location(s).`;
      }

      // COMMIT TRANSACTION: All changes succeed atomically
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      logger.error(`Error updating user with ID ${id}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to update user with ID ${id}: ${this.getErrorMessage(error)}`,
      );
    } finally {
      await queryRunner.release();
    }

    // Perform audit trail AFTER transaction commit to avoid deadlock/lock wait timeout
    try {
      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: "update",
          raw_data: JSON.stringify(userToUpdate),
          description: `Updated user ${id} - ${userToUpdate.user_name} | ${userToUpdate.first_name} ${userToUpdate.last_name}`,
          status_id: 1,
        },
        updateUserDto.updated_by,
      );
    } catch (auditError) {
      logger.warn(
        `Audit trail creation skipped or failed for user ID ${id}:`,
        auditError,
      );
    }

    // Fetch updated user with relations
    const updatedUser = await this.usersRepository.findOne({
      where: { id: savedUserId },
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
      this.sseEventEmitter.emitUpdateSignal("users", savedUserId);
      this.sseEventEmitter.emitUpdateSignal("users", 0);
      this.sseEventEmitter.emitUpdateSignal("locations", 0);
      await this.cacheInvalidationService.invalidateFindAll("users");
      await this.cacheInvalidationService.invalidateWarehouseEmployees();
      await this.cacheInvalidationService.invalidateWarehouseHurdles();
      await this.cacheInvalidationService.invalidateReqTransactions();
      await this.cacheInvalidationService.invalidateWarehouseRequirements();
      await this.cacheInvalidationService.invalidateWarehouses();
    } catch (err) {
      logger.warn("SSE event failed for update:", err);
    }

    logger.info(`User updated successfully with ID: ${id}`);
    return {
      message: responseMessage,
      user: await this.createFlattenedResponse(updatedUser!),
    };
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
        await this.cacheInvalidationService.invalidateFindAll("users");
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
        "Invalid user ID provided for status toggle.",
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
          },
        );

      // Update all UserLocations for this user
      const locationsUpdateResult = await this.userLocationsRepository.update(
        { user_id: id },
        {
          status_id: newStatusId,
          updated_by: userId,
          modified_at: new Date(),
        },
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
        userWithRelations!,
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
        authenticatedUserId,
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
        `Successfully toggled status for user with ID ${id} and all related records.`,
      );

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        this.sseEventEmitter.emitUpdateSignal("users", id);
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.warn("SSE event failed for update:", err);
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

  // Helper method to create user permissions (kept for backward compatibility in update method)
  private async createUserPermissions(
    userId: number,
    roleId: number,
    accessKeyIds: number[],
    userPermissionPresets: any[],
    createdBy: number,
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

  // Helper method to create user locations (kept for backward compatibility in update method)
  private async createUserLocations(
    userId: number,
    roleId: number,
    locationIds: number[],
    createdBy: number,
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
      where: { user_id: user.id, status_id: 1 },
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
          .filter(Boolean),
      ),
    );

    // Extract unique action names
    const actionNames = Array.from(
      new Set(
        userPermissions
          .map((up) => (up.action ? up.action.action_name : null))
          .filter(Boolean),
      ),
    );

    // Get user locations for this user
    const userLocations = await this.userLocationsRepository.find({
      where: { user_id: user.id, status_id: 1 },
      relations: ["location", "status"],
    });

    // Extract unique location names
    const locationNames = Array.from(
      new Set(
        userLocations
          .map((ul) => (ul.location ? ul.location.location_name : null))
          .filter(Boolean),
      ),
    );

    // Extract unique role_ids from user permissions
    const uniqueRoleIds = Array.from(
      new Set(userPermissions.map((up) => up.role_id).filter(Boolean)),
    );

    // Get role names for all unique role_ids
    const roleNames: string[] = [];
    for (const roleId of uniqueRoleIds) {
      const role = await this.roleRepository.findOne({
        where: { id: roleId },
      });
      if (role) {
        roleNames.push(role.role_name);
      }
    }

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
      role_ids: uniqueRoleIds,
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
      role_names: roleNames,
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
    perAccessKey: boolean = false,
    includeUserRoles: boolean = false,
    includeUserSystems: boolean = false,
    includeAllModules: boolean = false,
  ): Promise<any[]> {
    const nestedUsers = [];

    for (const user of users) {
      let wherePermissions: any = { user_id: user.id };
      if (includeAllModules) {
        wherePermissions.status_id = In([1, 2]); // include all modules regardless of status
      } else {
        wherePermissions.status_id = 1; // only active permissions
      }
      if (perAccessKey) {
        wherePermissions.access_key_id = user.current_access_key;
        wherePermissions.role_id = user.role_id;
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

      let whereUserLocations: any = { user_id: user.id, status_id: 1 };
      if (perAccessKey) {
        whereUserLocations.access_key_id = user.current_access_key;
        whereUserLocations.role_id = user.role_id;
      }
      // Get user locations for this user (all locations regardless of role for now)
      const userLocations = await this.userLocationsRepository.find({
        where: whereUserLocations,
        relations: ["location", "status"],
      });

      // Extract unique role_ids from user permissions
      const uniqueRoleIds = Array.from(
        new Set(userPermissions.map((up) => up.role_id).filter(Boolean)),
      );

      // Get role names and build role-aware structures
      const roleNames: string[] = [];
      const userRoles: any[] = [];
      const userPermissionsLocations: any[] = [];
      const userSystems: any[] = [];
      let moduleMap = new Map<number, any>();
      let accessKeyMap = new Map<number, any>();

      for (const roleId of uniqueRoleIds) {
        const role = await this.roleRepository.findOne({
          where: { id: roleId },
          relations: ["system"],
        });
        if (role) {
          roleNames.push(role.role_name);
          if (includeUserRoles) {
            userRoles.push({
              role_id: role.id,
              role_name: role.role_name,
            });
          }
          // Collect unique systems from roles
          if (includeUserSystems && role.system_id) {
            const existingSystem = userSystems.find(
              (sys) => sys.system_id === role.system_id,
            );
            if (!existingSystem) {
              userSystems.push({
                system_id: role.system_id,
                system_name: role.system?.system_name || null,
                system_abbr: role.system?.system_abbr || null,
              });
            }
          }
        }
      }

      // Build role-specific modules and locations if includeUserRoles is true
      if (includeUserRoles) {
        // Collect unique access keys from all active user permissions
        userPermissions.forEach((permission) => {
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
        });

        for (const roleId of uniqueRoleIds) {
          const role = await this.roleRepository.findOne({
            where: { id: roleId },
          });
          if (!role) continue;

          // Get permissions for this specific role
          const rolePermissions = userPermissions.filter(
            (up) =>
              up.role_id === roleId &&
              (includeAllModules
                ? up.status_id === 1 || up.status_id === 2
                : up.status_id === 1),
          );

          // Build modules for this role
          const roleModuleMap = new Map<number, any>();
          rolePermissions.forEach((permission) => {
            if (permission.module) {
              const moduleId = permission.module.id;

              if (!roleModuleMap.has(moduleId)) {
                roleModuleMap.set(moduleId, {
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
                  actions: [],
                });
              }

              const module = roleModuleMap.get(moduleId);

              // Add action to the module's actions array (if not already present for this access_key)
              if (
                permission.action &&
                !module.actions.find(
                  (a: any) =>
                    a.id === permission.action.id &&
                    a.access_key_id === permission.access_key_id,
                )
              ) {
                module.actions.push({
                  id: permission.action.id,
                  action_name: permission.action.action_name,
                  status_id: permission.action.status_id,
                  permission_status_id: permission.status_id,
                  access_key_id: permission.access_key_id,
                });
              }
            }
          });

          // Get locations for this role
          const roleLocations = userLocations
            .filter((ul) => ul.role_id === roleId)
            .map((ul) => ({
              id: ul.location?.id || null,
              location_name: ul.location?.location_name || null,
              access_key_id: ul.access_key_id,
              status_id: ul.location?.status_id || null,
              user_location_status_id: ul.status_id,
            }));

          // Add to user_permissions_locations array
          userPermissionsLocations.push({
            role_id: role.id,
            role_name: role.role_name,
            modules: Array.from(roleModuleMap.values()).sort(
              (a, b) => a.order_level - b.order_level,
            ),
            locations: roleLocations,
          });
        }
      } else {
        // Build top-level modules and locations (original behavior)
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
                actions: [],
              });
            }

            const module = moduleMap.get(moduleId);

            // Add action to the module's actions array (if not already present for this access_key)
            if (
              permission.action &&
              !module.actions.find(
                (a: any) =>
                  a.id === permission.action.id &&
                  a.access_key_id === permission.access_key_id,
              )
            ) {
              module.actions.push({
                id: permission.action.id,
                action_name: permission.action.action_name,
                status_id: permission.action.status_id,
                permission_status_id: permission.status_id,
                access_key_id: permission.access_key_id,
              });
            }
          }
        });
      }

      // Get the current access key name if current_access_key exists
      const currentAccessKeyName = user.current_access_key
        ? Array.from(accessKeyMap.values()).find(
            (ak) => ak.id === user.current_access_key,
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
              system_id: user.role.system_id,
              system_abbr: user.role.system
                ? user.role.system.system_abbr
                : null,
              system_name: user.role.system
                ? user.role.system.system_name
                : null,
            }
          : null,
        role_ids: uniqueRoleIds,
        role_names: roleNames,
        ...(includeUserRoles && { user_roles: userRoles }),
        ...(includeUserSystems && { user_systems: userSystems }),
        ...(includeUserRoles && {
          user_permissions_locations: userPermissionsLocations,
        }),
        access_keys: Array.from(accessKeyMap.values()),
        ...(!includeUserRoles && {
          modules: Array.from(moduleMap.values()).sort(
            (a, b) => a.order_level - b.order_level,
          ),
        }),
        ...(!includeUserRoles && {
          locations: userLocations.map((ul) => ({
            id: ul.location?.id || null,
            location_name: ul.location?.location_name || null,
            access_key_id: ul.access_key_id,
            status_id: ul.location?.status_id || null,
            user_location_status_id: ul.status_id,
          })),
        }),
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

  /**
   * Helper method to find a user by email for use by other services
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.usersRepository.findOne({
        where: { email },
        select: [
          "id",
          "email",
          "first_name",
          "last_name",
          "password",
          "status_id",
          "user_reset",
        ],
      });
    } catch (error) {
      logger.error(`Error finding user with email ${email}:`, error);
      return null;
    }
  }

  /**
   * Helper method to send welcome email to user
   * Used by uploadExcelUsers in both create and update blocks
   * Generates HTML email, sends via email service, and creates audit trail
   */
  private async sendUserWelcomeEmail(
    user: User,
    password: string,
    rowNum: number,
    created_by: number,
    request: any,
  ): Promise<void> {
    if (!user.email) {
      return;
    }

    try {
      const loginUrl = this.frontendUrlUtil.getFrontendUrlFromRequest(request);
      const companyName = process.env.COMPANY_NAME || "CTGI";
      const projectAbbr = process.env.PROJECT_ABBR || "SPA";

      const html = this.emailService.generateUserWelcomeEmail({
        userName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        password: password,
        loginUrl,
      });

      let emailStatus = "success";
      let emailError = null;

      try {
        await this.emailService.sendMail({
          to: user.email,
          subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
          html,
        });
      } catch (emailErr) {
        emailStatus = "error";
        emailError = this.getErrorMessage(emailErr);
        logger.error(
          `Failed to send welcome email to ${user.email}:`,
          emailErr,
        );
      }

      const method =
        rowNum > 0
          ? "uploadExcelUsers:sendWelcomeEmail"
          : "create:sendWelcomeEmail";
      const description =
        rowNum > 0
          ? `Welcome email ${emailStatus} for user created via Excel upload (row: ${rowNum} id: ${user.id})`
          : `Welcome email ${emailStatus} for user created (id: ${user.id})`;
      // Audit trail for email sending (success or error)
      await this.userAuditTrailCreateService.create(
        {
          service: "UsersService",
          method: method,
          raw_data: JSON.stringify({
            to: user.email,
            subject: `Welcome to ${companyName} ${projectAbbr} - Your Account Credentials`,
            status: emailStatus,
            error: emailError,
          }),
          description: description,
          status_id: 1,
        },
        created_by,
      );
    } catch (err) {
      logger.error(`Error in sendUserWelcomeEmail for user ${user.id}:`, err);
    }
  }

  async uploadExcelUsers(
    filePath: string,
    created_by: number,
    role_id: number,
    role_level: number,
    request?: any,
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

    // Define validation and formatting configuration for Excel users
    // Format is explicit - no automatic trimming. Use "trim"/"lowercase-trim"/"uppercase-trim" if needed
    const excelValidationConfig: ExcelValidationConfig = {
      requiredFields: {
        Username: { format: "lowercase-trim" },
        "Employee No.": { format: "trim" },
        "First Name": { format: "uppercase-trim" },
        "Last Name": { format: "uppercase-trim" },
        Email: { format: "lowercase-trim" },
        Password: { format: "trim" },
        "Access Keys": { format: "trim" },
        "Role(s)": { format: "trim" },
      },
      optionalFields: {
        "Middle Name": { format: "uppercase-trim", nullable: true },
        "User Upline ID": { format: "none", nullable: true },
        "Theme ID": { format: "none", nullable: true },
        "User Reset": { format: "none", nullable: true },
        "Send Email Notif": { format: "none", nullable: true },
        "Location(s)": { format: "none", nullable: true },
        "Overwrite Roles & Locations": { format: "none", nullable: true },
      },
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = row["__rowNum__"] || i + 2; // Excel row number (header + 1-based)
      try {
        // Validate and format row data using the utility function
        const formattedRow = validateAndFormatExcelRow(
          row,
          excelValidationConfig,
        );
        // 1. Lookup access keys (comma separated abbr)
        const accessKeyAbbrs = String(formattedRow["Access Keys"] || "")
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
            "Some Access Keys not found: " + accessKeyAbbrs.join(", "),
          );
        }
        // 2. Lookup multiple roles (comma separated)
        const roleNames = String(formattedRow["Role(s)"] || "")
          .split(",")
          .map((name: string) => name.trim())
          .filter(Boolean);

        if (roleNames.length === 0) {
          throw new Error("No roles provided in Role(s) column");
        }

        // Validate all roles exist and user has permission to create them
        const roles: Role[] = [];
        const allRoleActionPresets: any[] = [];
        const allRoleIds: number[] = [];

        for (const roleName of roleNames) {
          const role = await this.roleRepository.findOne({
            where: { role_name: roleName },
          });

          if (!role) {
            throw new Error("Role not found: " + roleName);
          }

          // Check if user uploading has permission to create this role
          if (role.role_level < role_level) {
            throw new Error(
              `Role level too low: ${roleName} requires level ${role.role_level}. Your role level hierarchy is only: ${role_level}`,
            );
          }

          roles.push(role);
          allRoleIds.push(role.id);

          // 3. Lookup role_action_preset for each role and generate per-access-key presets
          const roleActionPresets = await this.usersRepository.manager
            .getRepository("RoleActionPreset")
            .find({ where: { role_id: role.id, status_id: 1 } });

          // Multi-tenant: generate presets for EACH target access key
          for (const ak of accessKeys) {
            let akPresets = roleActionPresets.filter(
              (p) => p.access_key_id === ak.id,
            );
            // Fallback to role presets without specific access key if none matched
            if (akPresets.length === 0) {
              akPresets = roleActionPresets;
            }

            const moduleMap = new Map<number, number[]>();
            akPresets.forEach((preset) => {
              if (!moduleMap.has(preset.module_id)) {
                moduleMap.set(preset.module_id, []);
              }
              moduleMap.get(preset.module_id)!.push(preset.action_id);
            });

            moduleMap.forEach((actions, moduleId) => {
              allRoleActionPresets.push({
                role_id: role.id,
                access_key_id: ak.id,
                module_ids: moduleId,
                action_ids: actions,
              });
            });
          }
        }

        // Use first role as default role_id
        const primaryRole = roles[0];

        // Parse Overwrite mode: 1/true/yes = overwrite, 0/false/empty = Smart Append (default)
        const rawOverwrite = formattedRow["Overwrite Roles & Locations"];
        const isOverwrite =
          rawOverwrite === 1 ||
          rawOverwrite === "1" ||
          String(rawOverwrite || "")
            .trim()
            .toLowerCase() === "true" ||
          String(rawOverwrite || "")
            .trim()
            .toLowerCase() === "yes";

        // Check if Location(s) column has values and build user_location_presets per access key
        let userLocationPresets: any[] = [];

        if (
          formattedRow["Location(s)"] &&
          String(formattedRow["Location(s)"]).trim() !== ""
        ) {
          try {
            // Parse comma-separated location names
            const locationNames = String(formattedRow["Location(s)"])
              .split(",")
              .map((name: string) => name.trim())
              .filter(Boolean);

            // Look up locations by name
            const locations = await this.locationRepository.find({
              where: locationNames.map((name) => ({ location_name: name })),
            });

            // Check if at least one location was found
            if (locations.length > 0) {
              const locationIds = locations.map((loc) => loc.id);

              // Build user_location_presets for each role AND each access key
              for (const role of roles) {
                for (const ak of accessKeys) {
                  userLocationPresets.push({
                    role_id: role.id,
                    access_key_id: ak.id,
                    location_ids: locationIds,
                  });
                }
              }

              // Log any locations that weren't found
              if (locations.length < locationNames.length) {
                const foundNames = locations.map((loc) => loc.location_name);
                const notFound = locationNames.filter(
                  (name) => !foundNames.includes(name),
                );
                logger.warn(
                  `Some locations not found: ${notFound.join(", ")}. Using only the matched locations.`,
                );
              }
            } else {
              // No locations found at all, log the issue and fall back to presets
              logger.warn(
                `No locations matched from: ${locationNames.join(", ")}. Falling back to role location presets.`,
              );
            }
          } catch (locError) {
            logger.warn(
              `Error processing location names: ${this.getErrorMessage(locError)}. Falling back to role location presets.`,
            );
          }
        }

        // If no user_location_presets built yet, use role location presets for each role & access key
        if (userLocationPresets.length === 0) {
          for (const role of roles) {
            const roleLocationPresets = await this.usersRepository.manager
              .getRepository("RoleLocationPreset")
              .find({ where: { role_id: role.id, status_id: 1 } });

            for (const ak of accessKeys) {
              let akLocs = roleLocationPresets.filter(
                (p) => p.access_key_id === ak.id,
              );
              if (akLocs.length === 0) {
                akLocs = roleLocationPresets;
              }
              const roleLocationIds = Array.from(
                new Set(akLocs.map((preset) => preset.location_id)),
              );

              if (roleLocationIds.length > 0) {
                userLocationPresets.push({
                  role_id: role.id,
                  access_key_id: ak.id,
                  location_ids: roleLocationIds,
                });
              }
            }
          }
        }

        // 4. Check if user already exists (by user_name or email)
        let existingUser = await this.usersRepository.findOne({
          where: [
            { user_name: formattedRow["Username"] },
            { email: formattedRow["Email"] },
          ],
        });
        // Check for duplicate employee number (emp_number)
        if (formattedRow["Employee No."]) {
          const existingEmpNumber = await this.usersRepository.findOne({
            where: { emp_number: formattedRow["Employee No."] },
          });
          if (
            existingEmpNumber &&
            (!existingUser || existingEmpNumber.id !== existingUser.id)
          ) {
            errors.push({
              row: rowNum,
              error: `Duplicate Employee No.: ${formattedRow["Employee No."]} already exists`,
            });
            continue;
          }
        }

        if (existingUser) {
          // Query existing active user permissions to determine currently assigned roles & access keys
          const existingPermissions = await this.userPermissionsRepository.find(
            {
              where: { user_id: existingUser.id, status_id: 1 },
              select: ["role_id", "access_key_id"],
            },
          );
          const existingRoleIds = Array.from(
            new Set(
              existingPermissions
                .map((p) => p.role_id)
                .filter((r): r is number => typeof r === "number" && r > 0),
            ),
          );
          const existingAccessKeyIds = Array.from(
            new Set(
              existingPermissions
                .map((p) => p.access_key_id)
                .filter((k): k is number => typeof k === "number" && k > 0),
            ),
          );

          const newAccessKeyIds = accessKeys.map((k) => k.id);
          let updateUserDto: any;

          if (isOverwrite) {
            // OVERWRITE MODE (1):
            // Soft-deactivate previous roles and locations that are not present in this Excel row
            const rolesToDeactivate = existingRoleIds.filter(
              (rId) => !allRoleIds.includes(rId),
            );
            if (rolesToDeactivate.length > 0) {
              await this.userPermissionsRepository.update(
                { user_id: existingUser.id, role_id: In(rolesToDeactivate) },
                {
                  status_id: 2,
                  updated_by: created_by,
                  modified_at: new Date(),
                },
              );
              await this.userLocationsRepository.update(
                { user_id: existingUser.id, role_id: In(rolesToDeactivate) },
                {
                  status_id: 2,
                  updated_by: created_by,
                  modified_at: new Date(),
                },
              );
            }

            updateUserDto = {
              user_name: formattedRow["Username"],
              emp_number: formattedRow["Employee No."],
              first_name: formattedRow["First Name"],
              last_name: formattedRow["Last Name"],
              middle_name: formattedRow["Middle Name"],
              email: formattedRow["Email"],
              ...(formattedRow["Password"]
                ? { password: formattedRow["Password"] }
                : {}),
              current_access_key: accessKeys[0]?.id,
              role_id: primaryRole.id,
              role_ids: allRoleIds,
              status_id: 1,
              updated_by: created_by,
              user_reset: formattedRow["User Reset"] || false,
              theme_id: formattedRow["Theme ID"] || 1,
              access_key_id: newAccessKeyIds,
              user_permission_presets: allRoleActionPresets,
              user_location_presets: userLocationPresets,
              roles_to_update: allRoleIds,
            };
            await this.update(existingUser.id, updateUserDto);
          } else {
            // SMART APPEND / MERGE MODE (Default: 0 / Blank):
            // Preserve existing active roles & access keys; only update the newly uploaded roles!
            const mergedRoleIds = Array.from(
              new Set([...existingRoleIds, ...allRoleIds]),
            );
            const mergedAccessKeyIds = Array.from(
              new Set([...existingAccessKeyIds, ...newAccessKeyIds]),
            );

            updateUserDto = {
              user_name: formattedRow["Username"],
              emp_number: formattedRow["Employee No."],
              first_name: formattedRow["First Name"],
              last_name: formattedRow["Last Name"],
              middle_name: formattedRow["Middle Name"],
              email: formattedRow["Email"],
              ...(formattedRow["Password"]
                ? { password: formattedRow["Password"] }
                : {}),
              current_access_key:
                existingUser.current_access_key || accessKeys[0]?.id,
              role_id: existingUser.role_id || primaryRole.id,
              role_ids: mergedRoleIds,
              status_id: 1,
              updated_by: created_by,
              user_reset:
                formattedRow["User Reset"] ?? existingUser.user_reset ?? false,
              theme_id: formattedRow["Theme ID"] || existingUser.theme_id || 1,
              access_key_id: mergedAccessKeyIds,
              user_permission_presets: allRoleActionPresets,
              user_location_presets: userLocationPresets,
              roles_to_update: allRoleIds, // Only update the uploaded roles; other roles remain untouched and active!
            };
            await this.update(existingUser.id, updateUserDto);
          }
          // Audit trail for update
          await this.userAuditTrailCreateService.create(
            {
              service: "UsersService",
              method: "uploadExcelUsers",
              raw_data: JSON.stringify({ row: formattedRow, updateUserDto }),
              description: `User updated via Excel upload (row ${rowNum})`,
              status_id: 1,
            },
            created_by,
          );
          try {
            // Option 2: WITHOUT data
            this.sseEventEmitter.emitUpdateSignal("users", existingUser.id);
            this.sseEventEmitter.emitUpdateSignal("users", 0);
            await this.cacheInvalidationService.invalidateFindAll("users");
          } catch (err) {
            logger.warn("SSE event failed:", err);
          }

          // Send welcome email if requested
          if (formattedRow["Send Email Notif"]) {
            await this.sendUserWelcomeEmail(
              existingUser,
              formattedRow["Password"],
              rowNum,
              created_by,
              request,
            );
          }

          updated_count++;
          updated_row_numbers.push(rowNum);
          success.push({ ...formattedRow, __rowNum__: rowNum });
        } else {
          // Create logic

          const user = this.usersRepository.create({
            user_name: formattedRow["Username"],
            emp_number: formattedRow["Employee No."],
            first_name: formattedRow["First Name"],
            last_name: formattedRow["Last Name"],
            middle_name: formattedRow["Middle Name"],
            email: formattedRow["Email"],
            password: await bcrypt.hash(formattedRow["Password"], 10),
            current_access_key: accessKeys[0]?.id, // for main access key
            role_id: primaryRole.id, // Use primary (first) role as default
            status_id: 1,
            user_reset: true, // default to true on create
            user_upline_id: formattedRow["User Upline ID"] || null,
            theme_id: formattedRow["Theme ID"] || 1,
            profile_pic_url: "/uploads/profile_pics/default_profile.jpg",
            created_by,
          });
          const savedUser = await this.usersRepository.save(user);
          // Audit trail for insert
          await this.userAuditTrailCreateService.create(
            {
              service: "UsersService",
              method: "uploadExcelUsers",
              raw_data: JSON.stringify({ row: formattedRow, user: savedUser }),
              description: `User created via Excel upload (row ${rowNum})`,
              status_id: 1,
            },
            created_by,
          );

          // Create user_permissions for all access keys and all presets (which have role_ids)
          if (accessKeys.length > 0 && allRoleActionPresets.length > 0) {
            await this.createUserPermissionsFromPresets(
              savedUser.id,
              accessKeys.map((k) => k.id),
              allRoleActionPresets,
              created_by,
            );
          }

          // Create user_locations from presets
          if (userLocationPresets.length > 0) {
            await this.createUserLocationsFromPresets(
              savedUser.id,
              accessKeys.map((k) => k.id),
              userLocationPresets,
              created_by,
            );
          }

          inserted_count++;

          // Send welcome email if requested
          if (formattedRow["Send Email Notif"]) {
            await this.sendUserWelcomeEmail(
              savedUser,
              formattedRow["Password"],
              rowNum,
              created_by,
              request,
            );
          }

          inserted_row_numbers.push(rowNum);
          success.push({ ...formattedRow, __rowNum__: rowNum });
        }
      } catch (err) {
        errors.push({ row: rowNum, error: this.getErrorMessage(err) });
      }
    }
    if (inserted_count > 0) {
      try {
        // Option 2: WITHOUT data
        this.sseEventEmitter.emitCreateSignal("users", 0);
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        logger.warn("SSE event failed:", err);
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

  async getUserPermissionsByRole(role_id: number): Promise<number[]> {
    try {
      const userPermissions = await this.userPermissionsRepository.find({
        where: { role_id, status_id: 1 },
      });
      // return userPermissions.filter((up) => up.user_id !== null);
      const ids = userPermissions
        .filter((up) => up.user_id !== null)
        .map((up) => up.user_id as number);
      return Array.from(new Set(ids));
    } catch (error) {
      throw new Error(
        `Failed to get user ids permissions by role: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async getUserPermissionsByModule(module_id: number): Promise<number[]> {
    try {
      const userPermissions = await this.userPermissionsRepository.find({
        where: { module_id, status_id: 1 },
      });
      const ids = userPermissions
        .filter((up) => up.user_id !== null)
        .map((up) => up.user_id as number);
      return Array.from(new Set(ids));
    } catch (error) {
      throw new Error(
        `Failed to get user ids permissions by module: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async getUserPermissionsByAccessKey(
    access_key_id: number,
  ): Promise<number[]> {
    try {
      const userPermissions = await this.userPermissionsRepository.find({
        where: { access_key_id, status_id: 1 },
      });
      const ids = userPermissions
        .filter((up) => up.user_id !== null)
        .map((up) => up.user_id as number);
      return Array.from(new Set(ids));
    } catch (error) {
      throw new Error(
        `Failed to get user ids permissions by access key: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async getUserLocationsByLocation(location_id: number): Promise<number[]> {
    try {
      const userLocations = await this.userLocationsRepository.find({
        where: { location_id, status_id: 1 },
      });
      const ids = userLocations
        .filter((ul) => ul.user_id !== null)
        .map((ul) => ul.user_id as number);
      return Array.from(new Set(ids));
    } catch (error) {
      throw new Error(
        `Failed to get user ids locations by location: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async getUserPermissionsWithRolesAndSystems(
    user_id: number,
    access_key_id: number,
  ): Promise<any> {
    if (isNaN(user_id)) {
      throw new BadRequestException("Invalid user ID provided.");
    }

    try {
      // Validate user exists
      const user = await this.usersRepository.findOne({
        where: { id: user_id },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${user_id} not found.`);
      }

      // Get user permissions with role, system, and system access keys relations
      const userPermissions = await this.userPermissionsRepository.find({
        where: { user_id, status_id: 1, access_key_id },
        relations: ["role", "role.system", "role.system.system_access_keys"],
      });

      // Filter permissions to only include those where:
      // 1. The system has the provided access_key_id in its allowed access keys
      // 2. The permission's access_key_id matches the provided access_key_id
      const filteredPermissions = userPermissions.filter((permission) => {
        if (
          !permission.role ||
          !permission.role.system ||
          !permission.role.system.system_access_keys
        ) {
          return false;
        }

        // Check if access_key_id matches
        if (permission.access_key_id !== access_key_id) {
          return false;
        }

        // Check if this access key is allowed for this system
        return permission.role.system.system_access_keys.some(
          (sak: any) => sak.access_key_id === access_key_id,
        );
      });

      // Build user_systems array with deduplication by system_id
      const systemsMap = new Map<number, any>();

      for (const permission of filteredPermissions) {
        const systemKey = permission.role.system_id;

        // Check if this system is already in the map
        if (!systemsMap.has(systemKey)) {
          systemsMap.set(systemKey, {
            system_id: permission.role.system_id,
            system_name: permission.role.system.system_name || null,
            system_abbr: permission.role.system.system_abbr || null,
            system_status_id: permission.role.system.status_id || null,
            roles: [],
          });
        }

        // Add role to this system (avoid duplicates by role_id)
        const systemData = systemsMap.get(systemKey);
        const existingRole = systemData.roles.find(
          (r: any) => r.role_id === permission.role.id,
        );

        if (!existingRole && permission.role) {
          systemData.roles.push({
            role_id: permission.role.id,
            role_name: permission.role.role_name,
            role_status_id: permission.role.status_id,
          });
        }
      }

      // Transform to desired response format
      const userSystems = Array.from(systemsMap.values()).map((system) => {
        // Flatten the response to include the first role's details
        // or create separate entries for each role if needed
        return {
          system_id: system.system_id,
          system_name: system.system_name,
          system_abbr: system.system_abbr,
          system_status_id: system.system_status_id,
          roles: system.roles,
        };
      });

      logger.info(
        `Successfully retrieved permissions with roles and systems for user ID ${user_id}`,
      );

      return {
        user_id,
        user_systems: userSystems,
      };
    } catch (error) {
      logger.error(
        `Error retrieving permissions with roles and systems for user ID ${user_id}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve permissions with roles and systems for user ID ${user_id}.`,
      );
    }
  }
}
