import {
  IsNotEmpty,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
} from "class-validator";

export class CreateUserLocationsDto {
  @IsNotEmpty()
  @IsNumber()
  user_id!: number;

  @IsNotEmpty()
  @IsNumber()
  role_id!: number;

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  location_ids!: number[];

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
