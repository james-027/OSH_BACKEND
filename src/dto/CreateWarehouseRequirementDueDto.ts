import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
} from "class-validator";

export class CreateWarehouseRequirementDueDto {
  @IsInt()
  warehouse_requirement_id!: number;

  @IsDateString()
  warehouse_requirement_due_start!: string;

  @IsDateString()
  warehouse_requirement_due_end!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
