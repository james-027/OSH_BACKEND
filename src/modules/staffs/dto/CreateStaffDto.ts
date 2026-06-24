import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsNumber,
} from "class-validator";

export class CreateStaffDto {
  @IsOptional()
  @IsString()
  staff_code?: string;

  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  middle_name?: string;

  @IsInt()
  @IsNotEmpty()
  location_id!: number;

  @IsInt()
  @IsNotEmpty()
  vendor_id!: number;

  @IsInt()
  @IsNotEmpty()
  position_id!: number;
  
  @IsInt()
  @IsNotEmpty()
  brand_id!: number;

  @IsInt()
  @IsNotEmpty()
  category_type_id!: number;

  @IsNumber()
  @IsNotEmpty()
  allowance!: number;

  @IsNumber()
  @IsNotEmpty()
  salary_rate!: number;

  @IsInt()
  @IsNotEmpty()
  access_key_id!: number;

  @IsOptional()
  @IsString()
  sss_number?: string;

  @IsOptional()
  @IsString()
  pagibig_number?: string;

  @IsOptional()
  @IsString()
  tin?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  hired_date?: string;

  @IsOptional()
  @IsString()
  to_hr_date?: string;

  @IsOptional()
  @IsString()
  to_sts_date?: string;

  @IsOptional()
  @IsString()
  approved_eprf_date?: string;

  @IsOptional()
  @IsString()
  req_completion_date?: string;

  @IsOptional()
  @IsString()
  actual_deployment_date?: string;

  @IsOptional()
  @IsString()
  separated_date?: string;

  @IsOptional()
  @IsString()
  birthday?: string;

  @IsOptional()
  @IsString()
  contact_number?: string;

  @IsOptional()
  @IsString()
  overall_remarks?: string;

  @IsOptional()
  @IsString()
  store_request?: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}

export class CheckStaffDto {
  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  middle_name?: string;

  @IsString()
  last_name: string;
}


export class RevertStaffDto {
  @IsInt()
  status_id: number;

  @IsString()
  remarks: string;
}