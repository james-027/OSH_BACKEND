import { IsString, IsNotEmpty, IsOptional, IsInt, MaxLength } from "class-validator";

export class CreateCrewHubSystemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  system_abbr: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  system_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  system_url: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  system_icon?: string;

  @IsString()
  @IsOptional()
  system_description?: string;

  @IsInt()
  @IsOptional()
  system_status?: number;

  @IsInt()
  @IsOptional()
  order_seq?: number;
}

