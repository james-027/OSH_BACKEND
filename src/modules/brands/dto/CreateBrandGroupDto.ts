import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateBrandGroupDto {
  @IsNotEmpty({ message: "Brand group name is required" })
  @IsString({ message: "Brand group name must be a string" })
  @MaxLength(255, {
    message: "Brand group name cannot be longer than 255 characters",
  })
  brand_group_name!: string;

  @IsNotEmpty({ message: "Brand group abbreviation is required" })
  @IsString({ message: "Brand group abbreviation must be a string" })
  @MaxLength(50, {
    message: "Brand group abbreviation cannot be longer than 50 characters",
  })
  brand_group_abbr!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;
}
