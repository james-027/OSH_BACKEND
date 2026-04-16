import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
} from "class-validator";

export class CreateLocationHurdleDto {
  @IsNotEmpty()
  @IsInt()
  ss_hurdle_qty: number;

  @IsOptional()
  @IsNumber()
  location_rate?: number;

  @IsNotEmpty()
  @IsDateString()
  hurdle_date: string;

  @IsArray()
  @ArrayNotEmpty()
  location_ids: number[];

  @IsArray()
  @ArrayNotEmpty()
  item_category_ids: number[];

  @IsOptional()
  status_id?: number;

  @IsOptional()
  remarks?: string;
}
