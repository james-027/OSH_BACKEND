import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreatePositionDto {
  @IsNotEmpty({ message: "Position name is required" })
  @IsString({ message: "Position name must be a string" })
  @MaxLength(255, {
    message: "Position name cannot be longer than 255 characters",
  })
  position_name!: string;

  @IsNotEmpty({ message: "Position abbreviation is required" })
  @IsString({ message: "Position abbreviation must be a string" })
  @MaxLength(50, {
    message: "Position abbreviation cannot be longer than 50 characters",
  })
  position_abbr!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;
}

export default CreatePositionDto;
