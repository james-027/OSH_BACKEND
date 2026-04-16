import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
  IsArray,
  ArrayMinSize,
  ArrayNotEmpty,
} from "class-validator";

export class CreateRoleActionPresetDto {
  @IsNotEmpty({ message: "Role ID is required" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be a positive integer" })
  role_id!: number;

  @IsArray({ message: "Module IDs must be an array" })
  @ArrayNotEmpty({ message: "Module IDs array cannot be empty" })
  @ArrayMinSize(1, { message: "At least one module ID is required" })
  @IsInt({ each: true, message: "Each module ID must be an integer" }) // Validate each element
  @Min(1, { each: true, message: "Each module ID must be a positive integer" }) //  Validate each element
  module_ids!: number[]; // plural and array type

  @IsArray({ message: "Action IDs must be an array" })
  @ArrayNotEmpty({ message: "Action IDs array cannot be empty" })
  @ArrayMinSize(1, { message: "At least one action ID is required" })
  @IsInt({ each: true, message: "Each action ID must be an integer" }) // Validate each element
  @Min(1, { each: true, message: "Each action ID must be a positive integer" }) // Validate each element
  action_ids!: number[]; // plural and array type

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;
}
