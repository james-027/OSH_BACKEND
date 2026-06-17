import { IsInt, IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class CreateStaffSalaryDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;
  
  @IsInt()
  @IsNotEmpty()
  staff_vendor_id!: number;

  @IsNumber()
  @IsNotEmpty()
  allowance!: number;

  @IsNumber()
  @IsNotEmpty()
  salary_rate!: number;

  @IsInt()
  @IsNotEmpty()
  access_key_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
