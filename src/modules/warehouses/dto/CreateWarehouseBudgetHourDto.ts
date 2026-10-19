import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsDateString,
} from "class-validator";

export class CreateWarehouseBudgetHourDto {
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
  @IsDateString()
  budget_date_from: string;

  @IsNotEmpty()
  @IsDateString()
  budget_date_to: string;

  @IsNotEmpty()
  @IsNumber()
  budget_hours: number;

  @IsInt()
  status_id?: number;
}
