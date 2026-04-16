import { IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateWarehouseEmployeeDto {
  @IsNotEmpty()
  @IsInt()
  warehouse_id: number;

  @IsNotEmpty()
  @IsInt()
  assigned_ss: number;

  @IsNotEmpty()
  @IsInt()
  assigned_ah: number;

  @IsNotEmpty()
  @IsInt()
  assigned_bch?: number;

  @IsOptional()
  @IsInt()
  assigned_gbch?: number | null;

  @IsNotEmpty()
  @IsInt()
  assigned_rh?: number;

  @IsOptional()
  @IsInt()
  assigned_grh?: number | null;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;
}
