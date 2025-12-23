import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from "class-validator";

// Define interface for user permission presets
export interface UserPermissionPreset {
  module_ids: number;
  role_id: number;
  action_ids: number[];
}

// Define interface for user location presets
export interface UserLocationPreset {
  role_id: number;
  location_ids: number[];
}

export class CreateUserDto {
  @IsNotEmpty({ message: "User name is required" })
  @IsString({ message: "User name must be a string" })
  user_name!: string;

  @IsNotEmpty({ message: "First name is required" })
  @IsString({ message: "First name must be a string" })
  first_name!: string;

  @IsOptional()
  @IsString({ message: "Middle name must be a string" })
  middle_name?: string;

  @IsNotEmpty({ message: "Last name is required" })
  @IsString({ message: "Last name must be a string" })
  last_name!: string;

  @IsNotEmpty({ message: "Role ID is required" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be at least 1" })
  role_id!: number;

  @IsOptional()
  @IsArray({ message: "Role IDs must be an array" })
  @IsInt({ each: true, message: "Each role ID must be an integer" })
  role_ids?: number[];

  @IsOptional()
  @IsString({ message: "Employee number must be a string" })
  emp_number?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email must be a valid email address" })
  email?: string;

  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: "User reset must be a boolean" })
  user_reset?: boolean;

  @IsOptional()
  @IsInt({ message: "User upline ID must be an integer" })
  @Min(1, { message: "User upline ID must be at least 1" })
  user_upline_id?: number;

  @IsOptional()
  @IsBoolean({ message: "Email switch must be a boolean" })
  email_switch?: boolean;

  @IsNotEmpty({ message: "Status ID is required" })
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be at least 1" })
  status_id!: number;

  @IsNotEmpty({ message: "Theme ID is required" })
  @IsInt({ message: "Theme ID must be an integer" })
  @Min(1, { message: "Theme ID must be at least 1" })
  theme_id!: number;

  @IsOptional()
  @IsString({ message: "Profile picture URL must be a string" })
  profile_pic_url?: string;

  // UserPermissions fields
  @IsOptional()
  @IsArray({ message: "Access key IDs must be an array" })
  @IsInt({ each: true, message: "Each access key ID must be an integer" })
  access_key_id?: number[];

  @IsOptional()
  @IsArray({ message: "User permission presets must be an array" })
  user_permission_presets?: UserPermissionPreset[];

  @IsOptional()
  @IsArray({ message: "User location presets must be an array" })
  user_location_presets?: UserLocationPreset[];

  // UserLocations fields
  @IsOptional()
  @IsArray({ message: "Location IDs must be an array" })
  @IsInt({ each: true, message: "Each location ID must be an integer" })
  location_ids?: number[];

  // Additional field for audit
  @IsOptional()
  @IsInt({ message: "Created by must be an integer" })
  created_by?: number;

  @IsOptional()
  @IsInt({ message: "Updated by must be an integer" })
  updated_by?: number;
}
