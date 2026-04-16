import {
  IsInt,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class UserPermissionPresetDto {
  @IsInt()
  @IsNotEmpty()
  module_ids!: number;

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  action_ids!: number[];
}

export class CreateUserPermissionsDto {
  @IsInt()
  @IsNotEmpty()
  user_id!: number;

  @IsInt()
  @IsNotEmpty()
  role_id!: number;

  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  access_key_id!: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionPresetDto)
  @IsNotEmpty()
  user_permission_presets!: UserPermissionPresetDto[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}
