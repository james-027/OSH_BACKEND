import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

export class StaffScheduleReportFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  schedule_header_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;


  @IsOptional()
  @IsString()
  location_ids?: string;
  
  @IsOptional()
  @IsString()
  vendor_ids?: string;
}