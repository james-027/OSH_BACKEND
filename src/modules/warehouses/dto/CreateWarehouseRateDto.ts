import {
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
} from "class-validator";

export class CreateWarehouseRateDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  warehouse_ids: number[];

  @IsNotEmpty()
  @IsNumber()
  warehouse_rate: number;

  @IsInt()
  status_id?: number;
}
