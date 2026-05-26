import { IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class CreateStaffCategoryTypeDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsInt()
  @IsNotEmpty()
  category_type_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;


}
