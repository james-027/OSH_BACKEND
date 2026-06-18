import { IsInt, IsNotEmpty, IsOptional, IsNumber, IsString, IsDate } from "class-validator";

export class CreateStaffTrainingDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsInt()
  @IsNotEmpty()
  training_id!: number;

  @IsInt()
  @IsNotEmpty()
  warehouse_id!: number;

  @IsInt()
  @IsNotEmpty()
  employee_id!: number;

  @IsInt()
  @IsNotEmpty()
  sub_status_id!: number;

  @IsNumber()
  @IsNotEmpty()
  ratings!: number;

  @IsString()
  @IsNotEmpty()
  remarks!: string;

  @IsDate()
  @IsNotEmpty()
  training_start_date!: Date;

  @IsDate()
  @IsNotEmpty()
  training_end_date!: Date;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
