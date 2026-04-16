import { IsNotEmpty, IsInt, IsOptional, Min } from "class-validator";

export class UpdateRoleLocationPresetDto {
  @IsOptional()
  @IsNotEmpty({ message: "Role ID cannot be empty" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be a positive integer" })
  role_id?: number;

  @IsOptional()
  @IsNotEmpty({ message: "Location ID cannot be empty" })
  @IsInt({ message: "Location ID must be an integer" })
  @Min(1, { message: "Location ID must be a positive integer" })
  location_id?: number; // Remains singular for single-preset update

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;
}
