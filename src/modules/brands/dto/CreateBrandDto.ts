import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateBrandDto {
  @IsNotEmpty({ message: "Brand name is required" })
  @IsString({ message: "Brand name must be a string" })
  @MaxLength(255, {
    message: "Brand name cannot be longer than 255 characters",
  })
  brand_name!: string;

  @IsNotEmpty({ message: "Brand abbreviation is required" })
  @IsString({ message: "Brand abbreviation must be a string" })
  @MaxLength(50, {
    message: "Brand abbreviation cannot be longer than 50 characters",
  })
  brand_abbr!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "Brand group ID must be an integer" })
  @Min(1, { message: "Brand group ID must be a positive integer" })
  brand_group_id?: number;
}
