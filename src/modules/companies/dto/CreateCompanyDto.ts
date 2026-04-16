import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  company_name!: string;

  @IsString()
  @IsNotEmpty()
  company_abbr!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
