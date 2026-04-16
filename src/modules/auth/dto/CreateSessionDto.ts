import { IsOptional, IsString } from "class-validator";

export class CreateSessionDto {
  @IsOptional()
  @IsString()
  device_info?: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  user_agent?: string;
}
