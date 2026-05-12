import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsDateString,
  IsNumber,
} from "class-validator";

export class CreateAuditFormDetailsDto {
  @IsNotEmpty()
  @IsString()
  audit_reference_id: string;

  @IsNotEmpty()
  @IsString()
  audit_month: string;

  @IsNotEmpty()
  @IsDateString()
  audit_date: Date;

  @IsNotEmpty()
  @IsString()
  store_crew_name: string;

  @IsNotEmpty()
  @IsString()
  store_crew_code: string;

  @IsNotEmpty()
  @IsString()
  agency: string;

  @IsNotEmpty()
  @IsNumber()
  food_safety_score: number;

  @IsNotEmpty()
  @IsNumber()
  work_instruction_score: number;

  @IsNotEmpty()
  @IsNumber()
  product_quality_score: number;

  @IsNotEmpty()
  @IsNumber()
  ssop_score: number;

  @IsNotEmpty()
  @IsNumber()
  audit_final_score: number;

  @IsNotEmpty()
  @IsDateString()
  computed_at: Date;
  
  @IsNotEmpty()
  @IsInt()
  audit_by: number;

  @IsNotEmpty()
  @IsInt()
  store_id: number;

  @IsNotEmpty()
  @IsString()
  store_specialist: string;

  @IsNotEmpty()
  @IsString()
  area_head: string;

  @IsNotEmpty()
  @IsString()
  group_area_head: string;

  @IsNotEmpty()
  @IsString()
  group_business_center_head: string;

  @IsNotEmpty()
  @IsString()
  regional_head: string;

  @IsNotEmpty()
  @IsInt()
  location_id: number;

  @IsNotEmpty()
  @IsInt()
  status_id: number;

  @IsNotEmpty()
  @IsInt()
  audit_form_id: number;
}