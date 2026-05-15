import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateDebitAdviceGlAccountDto {
  @IsString()
  @IsNotEmpty()
  gl_code: string;

  @IsString()
  @IsNotEmpty()
  category_code: string;

  @IsString()
  @IsNotEmpty()
  category_name: string;

  @IsString()
  @IsNotEmpty()
  gl_name: string;

  @IsOptional()
  @IsString()
  old_code?: string;
}