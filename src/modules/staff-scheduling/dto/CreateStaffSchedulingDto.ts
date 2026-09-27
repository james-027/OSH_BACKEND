import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class CreateSchedulingDetailDto {
  @IsNotEmpty()
  @IsInt()
  staff_id: number;

  @IsOptional()
  @IsInt()
  schedule_header_id?: number;

  @IsOptional()
  @IsInt()
  actual_logs_detail_id?: number;

  @IsOptional()
  @IsInt()
  vendor_id?: number;

  @IsOptional()
  @IsInt()
  location_id?: number;

  @IsNotEmpty()
  @IsInt()
  warehouse_id: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsNotEmpty()
  @IsDateString()
  duty_start_time: string;

  @IsNotEmpty()
  @IsDateString()
  duty_end_time: string;

  @IsOptional()
  @IsDateString()
  operational_start_time?: string;

  @IsOptional()
  @IsDateString()
  operational_end_time?: string;

  @IsOptional()
  @IsString()
  diff_outlet?: string;

  @IsOptional()
  @IsInt()
  add_ot?: number;

  @IsOptional()
  @IsDateString()
  starting_time?: string;

  @IsOptional()
  @IsDateString()
  just_time_in?: string;

  @IsOptional()
  @IsDateString()
  just_time_out?: string;

  @IsOptional()
  @IsDateString()
  orig_time_in?: string;

  @IsOptional()
  @IsDateString()
  orig_time_out?: string;
  
  @IsOptional()
  @IsDateString()
  orig_break_out?: string;

  @IsOptional()
  @IsDateString()
  orig_break_in?: string;

  @IsOptional()
  @IsDateString()
  just_break_in?: string;

  @IsOptional()
  @IsDateString()
  just_break_out?: string;

  @IsOptional()
  @IsDateString()
  overtime_in?: string;

  @IsOptional()
  @IsDateString()
  overtime_out?: string;

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

  @IsOptional()
  @IsDateString()
  ending_time?: string;

  @IsOptional()
  @IsInt()
  working_day_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}

export class CreateScheduleHeaderDto {
  @IsNotEmpty()
  @IsDateString()
  schedule_date: string;

  @IsOptional()
  @IsInt()
  entry_no?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsInt()
  shifting_day?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSchedulingDetailDto)
  @IsNotEmpty()
  details: CreateSchedulingDetailDto[];
}
