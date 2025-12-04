import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
} from "class-validator";

export class CreateWarehouseRequirementStartDto {
  @IsInt()
  warehouse_requirement_id!: number;

  @IsDateString()
  warehouse_requirement_start!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
