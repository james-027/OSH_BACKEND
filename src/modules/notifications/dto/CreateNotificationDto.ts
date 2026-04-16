import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
} from "class-validator";

export class CreateNotificationDto {
  @IsInt()
  module_id: number;

  @IsInt()
  ref_id: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  raw_data?: any;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  to_user_ids: number[];
}
