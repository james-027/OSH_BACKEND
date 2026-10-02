import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateActualLogsHeaderDto {
  @IsNotEmpty()
  @IsString()
  tagging: string;

  @IsOptional()
  @IsInt()
  logs_type_id?: number;

  @IsOptional()
  @IsInt()
  created_by?: number;

  @IsOptional()
  @IsInt()
  updated_by?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}