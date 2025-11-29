import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateRequirementDto {
  @IsString()
  @IsNotEmpty()
  requirement_name!: string;

  @IsInt()
  renewal_type_id!: number;

  @IsInt()
  requirement_reminder!: number;

  @IsInt()
  requirement_start!: number;

  @IsInt()
  requirement_start_days!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsInt()
  reminder_type_1?: number;

  @IsOptional()
  @IsInt()
  reminder_type_2?: number;

  @IsOptional()
  @IsInt()
  reminder_type_3?: number;

  @IsOptional()
  @IsInt()
  reminder_type_4?: number;

  @IsOptional()
  @IsInt()
  reminder_type_5?: number;

  @IsOptional()
  @IsInt()
  reminder_type_6?: number;

  @IsOptional()
  @IsInt()
  reminder_type_7?: number;

  @IsOptional()
  @IsInt()
  reminder_type_8?: number;

  @IsOptional()
  @IsInt()
  reminder_type_9?: number;

  @IsOptional()
  @IsInt()
  reminder_type_10?: number;
}
