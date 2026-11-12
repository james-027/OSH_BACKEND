import {
  IsOptional,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
} from "class-validator";

export class UpdateUserWarehousesDto {
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsNumber()
  role_id?: number;

  @IsOptional()
  @IsNumber()
  access_key_id?: number;

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  warehouse_ids!: number[];

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
