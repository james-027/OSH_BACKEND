import { IsString, IsOptional } from "class-validator";

export class UpdateDebitAdviceCategoryDto {
  @IsOptional()
  @IsString()
  category_code?: string;

  @IsOptional()
  @IsString()
  category_name?: string;

  @IsOptional()
  @IsString()
  old_code?: string;

  @IsOptional()
  @IsString()
  company?: string;
}