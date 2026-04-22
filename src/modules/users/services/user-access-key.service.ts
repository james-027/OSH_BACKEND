import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { User } from "../../../entities/User";
import { AccessKey } from "../../../entities/AccessKey";
import { UserPermissions } from "../../../entities/UserPermissions";
import { UserLoginSession } from "../../../entities/UserLoginSession";
import { ChangeAccessKeyDto } from "../dto/ChangeAccessKeyDto";
import logger from "../../../config/logger";
import { Role } from "src/entities/Role";
import { SSEEventEmitterHelper } from "../../sse/services/sse-event-emitter.helper";
import { SSEEmitterService } from "../../sse/services/sse-emitter.service";
import { CacheInvalidationService } from "../../cache/services/cache-invalidation.service";

@Injectable()
export class UserAccessKeyService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(AccessKey)
    private accessKeyRepository: Repository<AccessKey>,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(UserLoginSession)
    private sessionRepository: Repository<UserLoginSession>,
    private jwtService: JwtService,
    private sseEventEmitter: SSEEventEmitterHelper,
    private sseEmitterService: SSEEmitterService,
    private cacheInvalidationService: CacheInvalidationService,
  ) {}
  async changeAccessKey(
    userId: number,
    changeAccessKeyDto: ChangeAccessKeyDto,
    authenticatedUserId: number,
    currentSessionId?: number,
  ): Promise<any> {
    const { access_key_id, role_id } = changeAccessKeyDto;

    try {
      // Validate user exists
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ["role", "status", "theme", "createdBy", "updatedBy"],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }

      // Validate access key exists
      const accessKey = await this.accessKeyRepository.findOne({
        where: { id: access_key_id },
      });

      if (!accessKey) {
        throw new BadRequestException(
          `Access key with ID ${access_key_id} not found.`,
        );
      }

      // Validate role exists
      const role = await this.roleRepository.findOne({
        where: { id: role_id },
      });

      if (!role) {
        throw new BadRequestException(
          role_id > 0
            ? `Role with ID ${role_id} not found.`
            : `Role is required.`,
        );
      }

      // Check if user has permission to use this access key
      const userPermission = await this.userPermissionsRepository.findOne({
        where: {
          user_id: userId,
          access_key_id: access_key_id,
          status_id: 1, // Only active permissions
        },
      });

      if (!userPermission) {
        throw new BadRequestException(
          `User does not have permission to use access key with ID ${access_key_id}.`,
        );
      }

      // Update user's current access key
      await this.usersRepository.update(
        { id: userId },
        {
          current_access_key: access_key_id,
          role_id: role_id,
          updated_by: authenticatedUserId,
          modified_at: new Date(),
        },
      );

      // Fetch updated user with relations
      const updatedUser = await this.usersRepository.findOne({
        where: { id: userId },
        relations: [
          "role",
          "userUpline",
          "status",
          "theme",
          "createdBy",
          "updatedBy",
          "currentAccessKey",
        ],
      });

      // Generate new JWT token with updated access key if session is provided
      let newAccessToken = null;
      if (currentSessionId && updatedUser) {
        const payload = {
          id: updatedUser.id,
          user_name: updatedUser.user_name,
          // role_id: updatedUser.role_id,
          role_id: role_id,
          status_id: updatedUser.status_id,
          current_access_key: access_key_id, // Updated access key
          session_id: currentSessionId,
        };

        newAccessToken = this.jwtService.sign(payload, {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRES_IN || "10m",
        });

        logger.info(
          `Generated new JWT token with updated access key ${access_key_id} for user ${userId}, session ${currentSessionId}`,
        );
      }

      logger.info(
        `Successfully updated current access key for user ID ${userId} to access key ID ${access_key_id}`,
      );

      const response = {
        message: `Successfully updated current access key.`,
        user: {
          id: updatedUser!.id,
          user_name: updatedUser!.user_name,
          first_name: updatedUser!.first_name,
          last_name: updatedUser!.last_name,
          full_name: `${updatedUser!.first_name} ${updatedUser!.last_name}`,
          current_access_key: updatedUser!.current_access_key,
          current_access_key_name:
            updatedUser!.currentAccessKey?.access_key_name || null,
          role_name: updatedUser!.role?.role_name || null,
          status_name: updatedUser!.status?.status_name || null,
          updated_by: authenticatedUserId,
          modified_at: updatedUser!.modified_at,
        },
      };

      // Include new access token if generated
      if (newAccessToken) {
        response["new_access_token"] = newAccessToken;
        response["token_updated"] = true;
        response["message"] +=
          " New access token generated with updated permissions.";
        // Get existing refresh token from user_login_sessions
        let refreshToken: string | null = null;
        if (currentSessionId) {
          const session = await this.sessionRepository.findOne({
            where: { id: currentSessionId },
          });
          refreshToken = session?.refresh_token || null;
        }
        response["refresh_token"] = refreshToken;
      }

      // SSE Events
      try {
        // Option 2: WITHOUT data (for Approach 2 - SSE + React Query on frontend)
        // this.sseEventEmitter.emitUpdateSignal("users", authenticatedUserId);
        this.sseEventEmitter.emitUpdateSignal("users", 0);
        const resourceList = [
          { resource: "locations" },
          { resource: "users" },
          { resource: "roles_presets" },
          { resource: "roles" },
          { resource: "modules" },
          { resource: "location_types" },
          { resource: "positions" },
          { resource: "regions" },
          { resource: "take_out_stores" },
          { resource: "employees" },
          { resource: "store_employees" },
          { resource: "transactions" },
          { resource: "store_hurdles" },
          { resource: "store_rates" },
          { resource: "requirements" },
          { resource: "store_requirements" },
          { resource: "access_keys" },
          { resource: "companies" },
          { resource: "audit_trail" },
          { resource: "warehouses" },
          { resource: "req_transactions" },
          { resource: "warehouse_employees" },
          { resource: "warehouse_hurdles" },
          { resource: "warehouse_rates" },
          { resource: "employees" },
          { resource: "positions" },
          { resource: "audit_trails" },
          { resource: "transactions" },
          { resource: "dashboard" },
          { resource: "modules" },
          { resource: "systems" },
          { resource: "requirements" },
          { resource: "renewal_types" },
          { resource: "reminder_types" },
          { resource: "role_presets" },
          { resource: "users", resourceId: authenticatedUserId },
        ];
        // Update specific resources that depend on role/access key context
        // Frontend only listens for UPDATE events, not INVALIDATE events
        this.sseEmitterService.updateSpecificResources(resourceList);
        await this.cacheInvalidationService.invalidateFindAll("users");
      } catch (err) {
        console.warn("SSE event failed for update:", err);
      }

      return response;
    } catch (error) {
      logger.error(
        `Error updating current access key for user ID ${userId}:`,
        error,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error(
        `Failed to update current access key for user ID ${userId}.`,
      );
    }
  }

  async getCurrentAccessKey(userId: number): Promise<any> {
    try {
      // Validate user exists
      const user = await this.usersRepository.findOne({
        where: { id: userId },
        relations: ["currentAccessKey", "role", "status"],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }

      logger.info(
        `Successfully retrieved current access key for user ID ${userId}`,
      );

      return {
        user_id: user.id,
        user_name: user.user_name,
        full_name: `${user.first_name} ${user.last_name}`,
        current_access_key: user.current_access_key,
        current_access_key_details: user.currentAccessKey
          ? {
              id: user.currentAccessKey.id,
              access_key_name: user.currentAccessKey.access_key_name,
              status_id: user.currentAccessKey.status_id,
            }
          : null,
        role_name: user.role?.role_name || null,
        status_name: user.status?.status_name || null,
      };
    } catch (error) {
      logger.error(
        `Error retrieving current access key for user ID ${userId}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve current access key for user ID ${userId}.`,
      );
    }
  }

  async getUserAvailableAccessKeys(userId: number): Promise<any> {
    try {
      // Validate user exists
      const user = await this.usersRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }

      // Get all access keys available to this user
      const userAccessKeys = await this.userPermissionsRepository
        .createQueryBuilder("up")
        .leftJoinAndSelect("up.accessKey", "accessKey")
        .select([
          "DISTINCT accessKey.id as id",
          "accessKey.access_key_name as access_key_name",
          "accessKey.status_id as status_id",
        ])
        .where("up.user_id = :userId", { userId })
        .andWhere("up.status_id = :statusId", { statusId: 1 })
        .andWhere("accessKey.status_id = :accessKeyStatusId", {
          accessKeyStatusId: 1,
        })
        .getRawMany();

      logger.info(
        `Successfully retrieved ${userAccessKeys.length} available access keys for user ID ${userId}`,
      );

      return {
        user_id: userId,
        user_name: user.user_name,
        full_name: `${user.first_name} ${user.last_name}`,
        current_access_key: user.current_access_key,
        available_access_keys: userAccessKeys.map((ak) => ({
          id: ak.id,
          access_key_name: ak.access_key_name,
          status_id: ak.status_id,
          is_current: ak.id === user.current_access_key,
        })),
      };
    } catch (error) {
      logger.error(
        `Error retrieving available access keys for user ID ${userId}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve available access keys for user ID ${userId}.`,
      );
    }
  }
}
