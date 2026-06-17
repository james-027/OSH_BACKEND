import {   IsString,IsNumber,IsOptional } from "class-validator";

export class UpdateStaffDeployDto {

  @IsNumber()
  warehouse_id: number;

  @IsOptional()
  @IsString()
  effectivity_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  remarks: string;
}