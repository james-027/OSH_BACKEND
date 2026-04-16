import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  ValidateIf,
} from "class-validator";

export class LoginUserDto {
  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  @ValidateIf((o) => !o.user_name)
  email?: string;

  @IsOptional()
  @IsString({ message: "User name must be a string" })
  @ValidateIf((o) => !o.email)
  user_name?: string;

  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  password!: string;
}
