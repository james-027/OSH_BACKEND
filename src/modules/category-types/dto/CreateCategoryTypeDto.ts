import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateCategoryTypeDto {
  @IsString()
  @IsNotEmpty()
  category_type_name!: string;

  @IsInt()
  @IsNotEmpty()
  category_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
