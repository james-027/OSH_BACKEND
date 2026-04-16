import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from "class-validator";

export class CreateLocationTypeDto {
  @IsNotEmpty({ message: "Location type name is required" })
  @IsString({ message: "Location type name must be a string" })
  @MaxLength(255, {
    message: "Location type name cannot be longer than 255 characters",
  })
  location_type_name!: string;

  @IsOptional() // status_id has a default in entity, but can be provided
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;
}
