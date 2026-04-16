import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
} from "class-validator";

export class CreateWarehouseHurdleDto {
  @IsOptional()
  @IsInt()
  warehouse_id?: number;

  @IsOptional()
  @IsNumber()
  warehouse_rate?: number;

  @IsNotEmpty()
  @IsInt()
  ss_hurdle_qty: number;

  @IsNotEmpty()
  @IsDateString()
  hurdle_date: string;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  warehouse_ids: number[];

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  item_category_ids: number[];
}
