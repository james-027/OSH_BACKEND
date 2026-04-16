import { IsInt, IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class UpdateUserPermissionPresetDto {
  @IsOptional()
  @IsInt()
  module_ids?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  action_ids?: number[];
}

export class UpdateUserPermissionsDto {
  @IsOptional()
  @IsInt()
  user_id?: number;

  @IsOptional()
  @IsInt()
  role_id?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  access_key_id?: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateUserPermissionPresetDto)
  user_permission_presets?: UpdateUserPermissionPresetDto[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}
