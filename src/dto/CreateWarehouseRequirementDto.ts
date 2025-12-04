import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateWarehouseRequirementDto {
  @IsInt()
  warehouse_id!: number;

  @IsInt()
  requirement_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
