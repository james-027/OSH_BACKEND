import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateActualLogsDetailDto {
  @IsOptional()
  @IsInt()
  staff_id?: number;

  @IsNotEmpty()
  @IsString()
  staff_code: string;

  @IsNotEmpty()
  @IsString()
  remarks: string;

  @IsOptional()
  @IsInt()
  warehouse_id?: number;

  @IsOptional()
  @IsInt()
  location_id?: number;

  @IsOptional()
  @IsInt()
  service_provider_id?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsDateString()
  logs_date?: string;

  @IsOptional()
  @IsDateString()
  time_in?: string;

  @IsOptional()
  @IsDateString()
  time_out?: string;

  @IsOptional()
  @IsDateString()
  break_out?: string;

  @IsOptional()
  @IsDateString()
  break_in?: string;

  @IsOptional()
  @IsDateString()
  overtime_in?: string;
  
  @IsOptional()
  @IsDateString()
  overtime_out?: string;

  @IsOptional()
  @IsDateString()
  orig_time_in?: string;
  @IsOptional()
  @IsDateString()
  orig_time_out?: string;

  @IsOptional()
  @IsDateString()
  orig_break_in?: string;

  @IsOptional()
  @IsDateString()
  orig_break_out?: string;

  @IsOptional()
  @IsNumber()
  working_hours?: number;

  @IsOptional()
  @IsInt()
  shift_type?: number;

  @IsOptional()
  @IsInt()
  created_by?: number;

  @IsOptional()
  @IsInt()
  updated_by?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  
  @IsOptional()
  @IsNumber()
  regular?: number;

  @IsOptional()
  @IsNumber()
  break_hours?: number;

  @IsOptional()
  @IsNumber()
  overtime?: number;

  @IsOptional()
  @IsNumber()
  twh?: number;
}