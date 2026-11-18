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

  @IsOptional()
  @IsInt()
  access_key_id?: number;

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

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  warehouse_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  vendor_ids?: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PresetDto)
  presets!: PresetDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  access_key_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  target_access_key_ids?: number[];

  @IsOptional()
  tenant_configs?: Record<
    number,
    {
      location_ids?: number[];
      warehouse_ids?: number[];
      vendor_ids?: number[];
      presets?: PresetDto[];
    }
  >;

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
  apply_permissions_to_users_only?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_locations_to_users?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_locations_to_users_only?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_warehouses_to_users?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_warehouses_to_users_only?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_vendors_to_users?: boolean;

  @IsOptional()
  @IsBoolean()
  apply_vendors_to_users_only?: boolean;
}
