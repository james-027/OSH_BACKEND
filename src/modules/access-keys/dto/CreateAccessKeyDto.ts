import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateAccessKeyDto {
  @IsString()
  @IsNotEmpty()
  access_key_name!: string;

  @IsString()
  @IsNotEmpty()
  access_key_abbr!: string;

  @IsInt()
  company_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
