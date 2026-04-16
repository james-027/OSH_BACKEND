import { IsInt, IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class CreateStaffVendorSalaryDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsInt()
  @IsNotEmpty()
  vendor_id!: number;

  @IsInt()
  @IsNotEmpty()
  location_id!: number;

  @IsNumber()
  @IsNotEmpty()
  allowance!: number;

  @IsNumber()
  @IsNotEmpty()
  salary_rate!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
