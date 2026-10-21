import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsDateString,
} from "class-validator";

export class CreateWarehouseSalaryDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  warehouse_ids: number[];

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  vendor_ids: number[];

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  position_ids: number[];

  @IsNotEmpty()
  @IsDateString()
  date_from: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsNotEmpty()
  @IsNumber()
  salary: number;

  @IsInt()
  status_id?: number;
}
