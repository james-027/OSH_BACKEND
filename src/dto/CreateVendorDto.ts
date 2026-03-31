import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber } from "class-validator";

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  vendor_name!: string;

  @IsString()
  @IsNotEmpty()
  vendor_code!: string;

  @IsInt()
  @IsNotEmpty()
  category_id!: number;

  @IsOptional()
  @IsNumber()
  tax?: number;

  @IsOptional()
  @IsNumber()
  vat?: number;

  @IsOptional()
  @IsNumber()
  asf?: number;

  @IsOptional()
  @IsInt()
  erp_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
