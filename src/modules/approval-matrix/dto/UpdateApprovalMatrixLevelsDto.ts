import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateApprovalMatrixLevelsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  isdeleted: number;

  @IsString()
  userid: string;

  @IsOptional()
  @IsNumber()
  approval_id?: number;

  @IsOptional()
  @IsNumber()
  opt_approval_id?: number;

  @IsOptional()
  @IsString()
  approval_title?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
