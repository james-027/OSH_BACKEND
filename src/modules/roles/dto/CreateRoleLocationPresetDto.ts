import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayNotEmpty,
} from "class-validator"; // NEW: IsArray, ArrayMinSize, ArrayNotEmpty

export class CreateRoleLocationPresetDto {
  @IsNotEmpty({ message: "Role ID is required" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be a positive integer" })
  role_id!: number;

  @IsArray({ message: "Location IDs must be an array" }) // MODIFIED: Changed to array
  @ArrayNotEmpty({ message: "Location IDs array cannot be empty" }) // NEW
  @ArrayMinSize(1, { message: "At least one location ID is required" }) // NEW
  @IsInt({ each: true, message: "Each location ID must be an integer" }) // NEW: Validate each element
  @Min(1, {
    each: true,
    message: "Each location ID must be a positive integer",
  }) // NEW: Validate each element
  location_ids!: number[]; // MODIFIED: Changed to array type

  @IsOptional() // status_id has a default in entity, but can be provided
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;
}
