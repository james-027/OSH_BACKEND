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

  @Type(() => Number)
  @IsNumber()
  userid: number;

  @Type(() => Number)
  @IsNumber()
  module?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalMatrixLevelsDto)
  approvalmatrixLevel!: CreateApprovalMatrixLevelsDto[];

  @IsOptional()
  status_id?: number;
}
