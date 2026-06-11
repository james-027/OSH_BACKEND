import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from "class-validator";

export class CreateStaffTrainingItemDto {
  @IsInt()
  @IsNotEmpty()
  training_id!: number;

  @IsOptional()
  @IsInt()
  warehouse_id?: number | null;

  @IsInt()
  @IsNotEmpty()
  employee_id!: number;

  @IsInt()
  @IsNotEmpty()
  sub_status_id!: number;

  @IsInt()
  @IsNotEmpty()
  status_id!: number;

  @IsNumber()
  @IsNotEmpty()
  ratings!: number;

  @IsString()
  @IsNotEmpty()
  remarks!: string;

  @IsOptional()
  @IsDateString()
  training_start_date?: string;

  @IsOptional()
  @IsDateString()
  training_end_date?: string;
}