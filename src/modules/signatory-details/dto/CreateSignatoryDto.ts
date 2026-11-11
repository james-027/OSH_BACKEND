
import {
  IsInt,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateSignatoryDetailDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  signatory_header_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  signatory_type_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  module_id?: number;
}
