import { IsInt, IsOptional } from "class-validator";

export class CreateEmployeeLocationDto {
  @IsInt()
  employee_id: number;

  @IsInt()
  location_id: number;

  @IsInt()
  @IsOptional()
  status_id?: number;

  @IsInt()
  @IsOptional()
  created_by?: number;

  @IsInt()
  @IsOptional()
  updated_by?: number;
}
