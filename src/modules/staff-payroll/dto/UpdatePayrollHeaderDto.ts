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

export class UpdatePayrollDetailDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  schedule_detail_id?: number;

  @IsOptional()
  @IsInt()
  staff_id?: number;

  @IsOptional()
  @IsString()
  staff_code?: string;

  @IsOptional()
  @IsInt()
  vendor_id?: number;

  @IsOptional()
  @IsInt()
  location_id?: number;

  @IsOptional()
  @IsInt()
  warehouse_id?: number;

  @IsOptional()
  @IsString()
  warehouse_ifs?: string;

  @IsOptional()
  @IsDateString()
  duty_start_time?: string;

  @IsOptional()
  @IsDateString()
  duty_end_time?: string;

  @IsOptional()
  @IsDateString()
  planned_duty_start_time?: string;

  @IsOptional()
  @IsDateString()
  planned_duty_end_time?: string;

  @IsOptional()
  @IsDateString()
  just_time_in?: string;

  @IsOptional()
  @IsDateString()
  overtime_in?: string;

  @IsOptional()
  @IsDateString()
  overtime_out?: string;

  @IsOptional()
  @IsDateString()
  just_time_out?: string;

  @IsOptional()
  @IsDateString()
  just_break_out?: string;

  @IsOptional()
  @IsDateString()
  just_break_in?: string;

  @IsOptional()
  @IsDateString()
  actual_time_in?: string;

  @IsOptional()
  @IsDateString()
  actual_time_out?: string;

  @IsOptional()
  @IsDateString()
  actual_break_in?: string;

  @IsOptional()
  @IsDateString()
  actual_break_out?: string;

  @IsOptional()
  @IsInt()
  add_ot?: number;

  @IsOptional()
  @IsInt()
  working_day_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsInt()
  attendance_status_id?: number;

  @IsOptional()
  @IsString()
  just_remarks?: string;

  @IsOptional()
  @IsNumber()
  regular?: number;

  @IsOptional()
  @IsNumber()
  overtime?: number;

  @IsOptional()
  @IsNumber()
  twh?: number;

  @IsOptional()
  @IsString()
  payroll_remarks?: string;

  @IsOptional()
  @IsNumber()
  regular_hours?: number;

  @IsOptional()
  @IsNumber()
  overtime_hours?: number;

  @IsOptional()
  @IsNumber()
  twh_hours?: number;

  @IsOptional()
  @IsNumber()
  break?: number;

  @IsOptional()
  @IsNumber()
  break_hours?: number;
}

export class UpdatePayrollHeaderDto {
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  id?: number[];

  @IsOptional()
  @IsDateString()
  payroll_date_from?: string;

  @IsOptional()
  @IsDateString()
  payroll_date_to?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  payroll_invoice?: string;

  @IsOptional()
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePayrollDetailDto)
  details?: UpdatePayrollDetailDto[];
}