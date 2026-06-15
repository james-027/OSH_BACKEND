import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateApprovalMatrixLevelsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  isdeleted: number;

  @Type(() => Number)
  @IsNumber()
  userid: number;

  @Type(() => Number)
  @IsNumber()
  approval_id?: number;

  @Type(() => Number)
  @IsNumber()
  opt_approval_id?: number;

  @IsOptional()
  @IsString()
  approval_title?: string;

  @Type(() => Number)
  @IsNumber()
  module?: number;

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
