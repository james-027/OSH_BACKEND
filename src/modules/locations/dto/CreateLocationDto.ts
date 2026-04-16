import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  IsString,
  MaxLength,
} from "class-validator"; // NEW: IsString, MaxLength

export class CreateLocationDto {
  @IsNotEmpty({ message: "Location name is required" }) // NEW
  @IsString({ message: "Location name must be a string" }) // NEW
  @MaxLength(255, {
    message: "Location name cannot be longer than 255 characters",
  }) // NEW
  location_name!: string; // NEW

  @IsNotEmpty({ message: "Location Type ID is required" })
  @IsInt({ message: "Location Type ID must be an integer" })
  @Min(1, { message: "Location Type ID must be a positive integer" })
  location_type_id!: number;

  @IsOptional() // status_id has a default in entity, but can be provided
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "Region ID must be an integer" })
  @Min(1, { message: "Region ID must be a positive integer" })
  region_id?: number;

  @IsNotEmpty({ message: "Location code is required" })
  @IsString({ message: "Location code must be a string" })
  @MaxLength(50, {
    message: "Location code cannot be longer than 50 characters",
  })
  location_code!: string;

  @IsOptional()
  @IsString({ message: "Location abbreviation must be a string" })
  @MaxLength(20, {
    message: "Location abbreviation cannot be longer than 20 characters",
  })
  location_abbr?: string;
}
