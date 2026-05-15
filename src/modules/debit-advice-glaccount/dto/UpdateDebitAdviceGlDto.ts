import { IsString, IsOptional } from "class-validator";

export class UpdateDebitAdviceGlAccountDto {
  @IsOptional()
  @IsString()
  gl_code?: string;

  @IsOptional()
  @IsString()
  category_code?: string;

  @IsOptional()
  @IsString()
  category_name?: string;

  @IsOptional()
  @IsString()
  gl_name?: string;

  @IsOptional()
  @IsString()
  old_code?: string;
}