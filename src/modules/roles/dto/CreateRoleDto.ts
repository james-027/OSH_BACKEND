import {
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
} from "class-validator";

export class CreateRoleDto {
  @IsNotEmpty({ message: "Role name is required" })
  @IsString({ message: "Role name must be a string" })
  role_name!: string;

  @IsNotEmpty({ message: "Role level is required" })
  @IsInt({ message: "Role level must be an integer" })
  @Min(0, { message: "Role level cannot be negative" })
  role_level!: number;

  @IsOptional() // status_id has a default in entity, but can be provided
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;

  @IsInt()
  system_id!: number;
}
