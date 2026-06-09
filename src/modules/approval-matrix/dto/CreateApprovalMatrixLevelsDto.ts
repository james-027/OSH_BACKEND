import { IsString, IsOptional, IsNumber } from "class-validator";
import { Type } from "class-transformer";
export class CreateApprovalMatrixLevelsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @Type(() => Number)
  @IsNumber()
  userid: number;

  @Type(() => Number)
  @IsNumber()
  approval_id: number;

  @Type(() => Number)
  @IsNumber()
  opt_approval_id: number;

  @IsOptional()
  @IsString()
  approval_title?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  status_id?: number;
}
