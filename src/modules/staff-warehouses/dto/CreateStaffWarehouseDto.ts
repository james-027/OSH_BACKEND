import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from "class-validator";

export class CreateStaffWarehouseDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsString()
  @IsNotEmpty()
  staff_code!: string;

  @IsInt()
  @IsNotEmpty()
  warehouse_id!: number;

  @IsInt()
  @IsNotEmpty()
  location_id!: number;

  @IsInt()
  @IsNotEmpty()
  vendor_id!: number;

  @IsOptional()
  @IsDateString()
  effectivity_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsInt()
  @IsNotEmpty()
  access_key_id!: number;
}
