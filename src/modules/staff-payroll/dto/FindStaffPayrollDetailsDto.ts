import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
} from "class-validator";

export class FindStaffPayrollDetailsDto {
  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  location_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  vendor_ids?: number[];
}