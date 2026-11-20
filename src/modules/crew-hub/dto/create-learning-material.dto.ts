import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MaxLength,
  IsDateString,
} from "class-validator";

export class CreateLearningMaterialDto {
  @IsInt()
  @IsOptional()
  learning_material_type_id?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  learning_material_name: string;

  @IsString()
  @IsOptional()
  learning_material_description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  learning_material_url: string;

  @IsInt()
  @IsOptional()
  learning_material_status?: number;

  @IsDateString()
  @IsOptional()
  learning_material_start_date?: string | null;

  @IsDateString()
  @IsOptional()
  learning_material_end_date?: string | null;

  @IsInt()
  @IsOptional()
  order_seq?: number;
}

