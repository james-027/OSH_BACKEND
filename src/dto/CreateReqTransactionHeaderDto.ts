import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
} from "class-validator";

export class CreateReqTransactionHeaderDto {
  @IsInt()
  warehouse_id!: number;

  @IsInt()
  requirement_id!: number;

  @IsDateString()
  trans_date: string;

  @IsString()
  trans_remarks?: string;

  @IsOptional()
  @IsInt()
  trans_due_status_id?: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
