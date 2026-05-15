import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateDebitAdviceCategoryDto {
  @IsString()
  @IsNotEmpty()
  category_code: string;

  @IsString()
  @IsNotEmpty()
  category_name: string;

  @IsOptional()
  @IsString()
  old_code?: string;

  @IsOptional()
  @IsString()
  company?: string;
}