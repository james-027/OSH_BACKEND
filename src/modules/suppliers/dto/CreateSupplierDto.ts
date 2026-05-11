import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  suppliercode?: string;

  @IsOptional()
  @IsString()
  suppliername?: string;

  @IsOptional()
  @IsString()
  oldcode?: string;
}