
import {
  IsInt,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateSignatoryDetailDto {

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id?: number;
  
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
  signatoree_id?: number;


  @IsOptional()
  @Type(() => Number)
  @IsInt()
  module_id?: number;
}

export class CreateSignatoryHeaderDto {

  @IsNotEmpty()
  @IsInt()
  module_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSignatoryDetailDto)
  @IsNotEmpty()
  details: CreateSignatoryDetailDto[];
}