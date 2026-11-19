import {
  IsNotEmpty,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
} from "class-validator";

export class CreateUserWarehousesDto {
  @IsNotEmpty()
  @IsNumber()
  user_id!: number;

  @IsNotEmpty()
  @IsNumber()
  role_id!: number;

  @IsNotEmpty()
  @IsNumber()
  access_key_id!: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  warehouse_ids?: number[];

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
