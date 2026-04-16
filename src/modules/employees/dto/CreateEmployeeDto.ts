import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsInt,
} from "class-validator";

export class CreateEmployeeDto {
  @IsNotEmpty()
  @IsString()
  employee_number: string;

  @IsNotEmpty()
  @IsString()
  employee_first_name: string;

  @IsNotEmpty()
  @IsString()
  employee_last_name: string;

  @IsOptional()
  // @IsEmail()
  employee_email?: string;

  @IsNotEmpty()
  @IsInt()
  position_id: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;

  @IsNotEmpty()
  location_ids: number[];
}
