import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsString,
  IsOptional,
  IsNumber,
} from "class-validator";

import { CreateApprovalMatrixLevelsDto } from "./CreateApprovalMatrixLevelsDto";

export class CreateApprovalMatrixDetailsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsString()
  approval_title: string;

  @IsString()
  userid: string;

  @IsString()
  approval_id: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalMatrixLevelsDto)
  approvalmatrixLevel!: CreateApprovalMatrixLevelsDto[];

  @IsOptional()
  status_id?: number;
}
