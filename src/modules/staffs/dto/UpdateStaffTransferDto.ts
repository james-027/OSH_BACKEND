import { IsNumber,IsString } from "class-validator";

export class UpdateStaffTransferDto {
  @IsNumber()
  vendor_id: number;

  @IsNumber()
  location_id: number;
  
  @IsNumber()
  allowance: number;
  
  @IsNumber()
  salary_rate: number;

  @IsString()
  effectivity_date: string;

  @IsString()
  remarks?: string;

}