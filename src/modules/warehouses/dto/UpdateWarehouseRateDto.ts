import { CreateWarehouseRateDto } from "./CreateWarehouseRateDto";
import { PartialType } from "@nestjs/mapped-types";
import {
  IsOptional,
  IsArray,
  IsInt,
  IsNumber,
  ArrayNotEmpty,
} from "class-validator";

export class UpdateWarehouseRateDto extends PartialType(
  CreateWarehouseRateDto,
) {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  warehouse_ids?: number[];

  @IsOptional()
  @IsNumber()
  warehouse_rate?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
