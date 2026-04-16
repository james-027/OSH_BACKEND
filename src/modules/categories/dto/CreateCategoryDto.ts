import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  category_name!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
