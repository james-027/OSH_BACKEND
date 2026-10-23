import { IsNumber,IsOptional,IsString } from "class-validator";

export class UpdateStaffTransferDto {
  @IsNumber()
  vendor_id: number;

  @IsNumber()
  location_id: number;
  
  @IsNumber()
  @IsOptional()
  allowance?: number;
  
  @IsNumber()
  @IsOptional()
  salary_rate?: number;

  @IsString()
  effectivity_date: string;

  @IsString()
  remarks?: string;

}