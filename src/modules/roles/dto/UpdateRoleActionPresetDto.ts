import { IsNotEmpty, IsInt, IsOptional, Min } from "class-validator";

export class UpdateRoleActionPresetDto {
  @IsOptional()
  @IsNotEmpty({ message: "Role ID cannot be empty" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be a positive integer" })
  role_id?: number;

  @IsOptional()
  @IsNotEmpty({ message: "Module ID cannot be empty" })
  @IsInt({ message: "Module ID must be an integer" })
  @Min(1, { message: "Module ID must be a positive integer" })
  module_id?: number;

  @IsOptional()
  @IsNotEmpty({ message: "Action ID cannot be empty" })
  @IsInt({ message: "Action ID must be an integer" })
  @Min(1, { message: "Action ID must be a positive integer" })
  action_id?: number;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;
}
