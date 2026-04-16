import { IsInt, IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateActionLogDto {
  @IsInt()
  module_id: number;

  @IsInt()
  ref_id: number;

  @IsInt()
  action_id: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  raw_data?: any;
}
