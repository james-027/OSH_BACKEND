import {
  IsOptional,
  IsNumber,
  IsArray,
  ArrayNotEmpty,
  IsNotEmpty,
} from "class-validator";

export class UpdateUserLocationsDto {
  @IsOptional()
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @IsNumber()
  role_id?: number;

  // @IsOptional()
  // @IsNumber()
  // location_id?: number;

  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  location_ids!: number[];

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
