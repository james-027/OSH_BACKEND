import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPermissions } from "../entities/UserPermissions";
import { Module } from "../entities/Module";
import { Action } from "../entities/Action";
import { Location } from "../entities/Location";
import {
  PERMISSIONS_KEY,
  PermissionRequirement,
} from "../decorators/permissions.decorator";
import logger from "../config/logger";

@Injectable()
export class DynamicPermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UserPermissions)
    private userPermissionsRepository: Repository<UserPermissions>,
    @InjectRepository(Module)
    private moduleRepository: Repository<Module>,
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionRequirement[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException("User not authenticated");
    }

    try {
      // Special handling for toggle-status endpoints
      const isToggleStatus = request.route?.path?.includes("toggle-status");

      if (isToggleStatus && request.params?.id) {
        return await this.checkToggleStatusPermission(
          user.id,
          parseInt(request.params.id),
          "LOCATIONS",
          user.current_access_key, // Include access key ID
        );
      }

      // Standard permission checking
      for (const permission of requiredPermissions) {
        let hasPermission = false;

        // Normalize modules to array for unified OR logic handling
        const modules = Array.isArray(permission.module)
          ? permission.module
          : [permission.module];

        // Normalize actions to array for unified handling
        const actions = Array.isArray(permission.action)
          ? permission.action
          : [permission.action];

        // Check if user has permission for ANY module + ANY action (OR logic)
        for (const module of modules) {
          // Apply dynamic suffix if provided (appends query param value to module name)
          let finalModule = module;
          if (permission.dynamicModuleSuffix) {
            const paramValue = request.query[permission.dynamicModuleSuffix];
            if (paramValue) {
              finalModule = `${module} ${paramValue}`;
            }
          }

          for (const action of actions) {
            const hasThisAction = await this.checkUserPermission(
              user.id,
              finalModule,
              action,
              user.current_access_key, // Include access key ID
            );

            if (hasThisAction) {
              hasPermission = true;
              break; // Found one matching action, no need to check others
            }
          }

          if (hasPermission) break; // Found matching module, skip others
        }

        if (!hasPermission) {
          const moduleList = Array.isArray(permission.module)
            ? `(${permission.module.join(" OR ")})`
            : permission.module;
          const actionList = Array.isArray(permission.action)
            ? `(${permission.action.join(" OR ")})`
            : permission.action;
          const suffixInfo = permission.dynamicModuleSuffix
            ? ` with ${permission.dynamicModuleSuffix}=${request.query[permission.dynamicModuleSuffix]}`
            : "";
          logger.warn(
            `User ${user.id} denied access: Missing ${actionList} permission for ${moduleList} module${suffixInfo} with access key ${user.current_access_key}`,
          );
          throw new ForbiddenException(
            `Access denied: You don't have ${actionList} permission for ${moduleList}${suffixInfo}`,
          );
        }
      }

      return true;
    } catch (error) {
      logger.error("Error checking permissions:", error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException("Permission check failed");
    }
  }
  private async checkToggleStatusPermission(
    userId: number,
    resourceId: number,
    moduleName: string,
    accessKeyId?: number,
  ): Promise<boolean> {
    try {
      // Get the current status of the location
      const location = await this.locationRepository.findOne({
        where: { id: resourceId },
      });

      if (!location) {
        throw new ForbiddenException("Resource not found");
      }

      // Determine required action based on current status
      // If status_id = 1 (active), user needs DEACTIVATE permission
      // If status_id = 2 (inactive), user needs ACTIVATE permission
      const requiredAction =
        location.status_id === 1 ? "DEACTIVATE" : "ACTIVATE";

      const hasPermission = await this.checkUserPermission(
        userId,
        moduleName,
        requiredAction,
        accessKeyId, // Include access key ID
      );

      if (!hasPermission) {
        logger.warn(
          `User ${userId} denied toggle access: Missing ${requiredAction} permission for ${moduleName} module with access key ${accessKeyId}`,
        );
        throw new ForbiddenException(
          `Access denied: You don't have ${requiredAction} permission for ${moduleName}`,
        );
      }

      return true;
    } catch (error) {
      logger.error("Error in checkToggleStatusPermission:", error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      return false;
    }
  }
  private async checkUserPermission(
    userId: number,
    moduleName: string,
    actionName: string,
    accessKeyId?: number,
  ): Promise<boolean> {
    try {
      // Find the module by name
      const module = await this.moduleRepository.findOne({
        where: { module_name: moduleName.toUpperCase() },
      });

      if (!module) {
        logger.warn(`Module not found: ${moduleName}`);
        return false;
      }

      // Find the action by name
      const action = await this.actionRepository.findOne({
        where: { action_name: actionName.toUpperCase() },
      });

      if (!action) {
        logger.warn(`Action not found: ${actionName}`);
        return false;
      }

      // Build permission query conditions
      const whereConditions: any = {
        user_id: userId,
        module_id: module.id,
        action_id: action.id,
        status_id: 1, // Active status
      };

      // Add access key filter if provided
      if (accessKeyId) {
        whereConditions.access_key_id = accessKeyId;
      }

      // Check if user has the permission
      const userPermission = await this.userPermissionsRepository.findOne({
        where: whereConditions,
      });

      return !!userPermission;
    } catch (error) {
      logger.error("Error in checkUserPermission:", error);
      return false;
    }
  }
}
