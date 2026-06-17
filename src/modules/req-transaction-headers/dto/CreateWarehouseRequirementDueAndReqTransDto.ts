import { IsInt, IsOptional, IsDateString } from "class-validator";

export class CreateWarehouseRequirementDueAndReqTransDto {
  @IsInt()
  trans_header_id!: number;

  // @IsInt()
  // trans_due_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  cancellation_reason?: string;

  @IsOptional()
  termination_reason?: string;
}
