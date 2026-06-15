import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateApprovalMatrixLevelsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

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
  status_id?: number;
}
