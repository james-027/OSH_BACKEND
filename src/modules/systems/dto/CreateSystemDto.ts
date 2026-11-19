import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsArray,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateSystemDto {
  @IsString()
  @IsNotEmpty()
  system_name!: string;

  @IsString()
  @IsNotEmpty()
  system_abbr!: string;

  @ValidateIf((_, val) => val !== null && val !== undefined && val !== "")
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  parent_id?: number | null;

  @IsArray()
  @IsInt({ each: true })
  access_key_ids!: number[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}
