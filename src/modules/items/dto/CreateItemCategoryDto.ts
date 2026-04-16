import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  IsInt,
} from "class-validator";

export class CreateItemCategoryDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsInt()
  level: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
