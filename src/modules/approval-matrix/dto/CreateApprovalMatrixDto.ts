import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { CreateApprovalMatrixDetailsDto } from "./CreateApprovalMatrixDetailsDto";

export class CreateApprovalMatrixDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsString()
  userid: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalMatrixDetailsDto)
  lines!: CreateApprovalMatrixDetailsDto[];

  @IsOptional()
  access_key_id?: number;

  @IsOptional()
  status_id?: number;
}
