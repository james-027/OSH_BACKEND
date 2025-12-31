import {
  IsInt,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
  IsBoolean,
  Allow,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

class PresetDto {
  @IsInt()
  module_ids!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  action_ids!: number[];

  // Optional fields (sent from frontend but not validated)
  @Allow()
  role_id?: number;

  @Allow()
  module_name?: string;

  @Allow()
  order_level?: number;
}

export class CreateRolePresetDto {
  @IsInt()
  role_id!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  location_ids!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PresetDto)
  presets!: PresetDto[];

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  user_ids?: number[];

  @IsOptional()
  @IsBoolean()
  apply_permissions_to_users?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_locations_to_users?: boolean;
}
