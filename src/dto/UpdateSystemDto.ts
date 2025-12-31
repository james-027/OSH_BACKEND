import { IsString, IsOptional, IsInt, IsArray } from "class-validator";

export class UpdateSystemDto {
  @IsOptional()
  @IsString()
  system_name?: string;

  @IsOptional()
  @IsString()
  system_abbr?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  access_key_ids?: number[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}
