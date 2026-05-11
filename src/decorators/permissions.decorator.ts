import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

export interface PermissionRequirement {
  module: string | string[]; // Supports OR logic: check any module in array
  action: string | string[];
  dynamicModuleSuffix?: string; // Optional: append query param value to module name
}

export const RequirePermissions = (...permissions: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
