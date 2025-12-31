import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray } from "class-validator";

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty()
  system_name!: string;

  @IsString()
  @IsNotEmpty()
  system_abbr!: string;

  @IsArray()
  @IsInt({ each: true })
  access_key_ids!: number[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}
