import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { UpdateApprovalMatrixLevelsDto } from "./UpdateApprovalMatrixLevelsDto";

export class UpdateApprovalMatrixDetailsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  isdeleted: number;

  @IsString()
  approval_title: string;

  @IsString()
  userid: string;

  @IsNumber()
  approval_id: number;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsNumber()
  status_id?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateApprovalMatrixLevelsDto)
  approvalmatrixLevel!: UpdateApprovalMatrixLevelsDto[];
}
