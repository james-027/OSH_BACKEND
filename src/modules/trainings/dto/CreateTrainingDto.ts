import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsNumber,
} from "class-validator";

export class CreateTrainingDto {


  @IsString()
  @IsNotEmpty()
  training_name!: string;

  @IsString()
  @IsNotEmpty()
  training_abbr!: string;

  @IsOptional()
  @IsInt()
  access_key_id?: number;

  @IsInt()
  @IsNotEmpty()
  passing_rate?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
