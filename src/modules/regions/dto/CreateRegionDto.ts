import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsNumber,
} from "class-validator";

export class CreateRegionDto {
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  region_name: string;

  @IsNotEmpty()
  @IsString()
  @Length(1, 50)
  region_abbr: string;

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
