import { IsString, IsOptional } from "class-validator";

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  suppliercode?: string;

  @IsOptional()
  @IsString()
  suppliername?: string;

  @IsOptional()
  @IsString()
  oldcode?: string;
}