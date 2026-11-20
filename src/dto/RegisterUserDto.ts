import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  MinLength,
  MaxLength,
} from "class-validator";

export class RegisterUserDto {
  @IsNotEmpty({ message: "User name is required" })
  @IsString({ message: "User name must be a string" })
  user_name!: string;

  @IsNotEmpty({ message: "First name is required" })
  @IsString({ message: "First name must be a string" })
  first_name!: string;

  @IsOptional()
  @IsString({ message: "Middle name must be a string" })
  middle_name?: string;

  @IsNotEmpty({ message: "Last name is required" })
  @IsString({ message: "Last name must be a string" })
  last_name!: string;

  @IsNotEmpty({ message: "Role ID is required" })
  @IsInt({ message: "Role ID must be an integer" })
  @Min(1, { message: "Role ID must be at least 1" })
  role_id!: number;

  @IsOptional()
  @IsString({ message: "Employee number must be a string" })
  emp_number?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email must be a valid email address" })
  email?: string;

  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @MaxLength(100, { message: "Password cannot be longer than 100 characters" })
  password!: string;

  @IsOptional()
  @IsBoolean({ message: "User reset must be a boolean" })
  user_reset?: boolean;

  @IsOptional()
  @IsInt({ message: "User upline ID must be an integer" })
  @Min(1, { message: "User upline ID must be at least 1" })
  user_upline_id?: number;

  @IsOptional()
  @IsBoolean({ message: "Email switch must be a boolean" })
  email_switch?: boolean;

  @IsNotEmpty({ message: "Status ID is required" })
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be at least 1" })
  status_id!: number;

  @IsNotEmpty({ message: "Theme ID is required" })
  @IsInt({ message: "Theme ID must be an integer" })
  @Min(1, { message: "Theme ID must be at least 1" })
  theme_id!: number;

  @IsOptional()
  @IsString({ message: "Profile picture URL must be a string" })
  profile_pic_url?: string;

  @IsOptional()
  @IsString({ message: "Signature URL must be a string" })
  signature_url?: string;
}
