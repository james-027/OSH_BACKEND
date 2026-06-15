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
  @IsString()
  approval_id?: string;

  @IsOptional()
  @IsString()
  opt_approval_id?: string;

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
