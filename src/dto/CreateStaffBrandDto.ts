import { IsInt, IsNotEmpty, IsOptional } from "class-validator";

export class CreateStaffBrandDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsInt()
  @IsNotEmpty()
  brand_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
