import { IsInt, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class CreateTransactionDetailDto {
  @IsInt()
  transaction_header_id: number;

  @IsInt()
  warehouse_id: number;

  @IsNumber()
  budget_volume: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  ss_hurdle_qty: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  sales_qty: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  rate: number;

  @IsInt()
  status_id: number;

  @IsOptional()
  @IsInt()
  assigned_ss: number | null;

  @IsOptional()
  @IsInt()
  assigned_ah: number | null;

  @IsOptional()
  @IsInt()
  assigned_bch?: number | null;

  @IsOptional()
  @IsInt()
  assigned_gbch?: number | null;

  @IsOptional()
  @IsInt()
  assigned_rh?: number | null;

  @IsOptional()
  @IsInt()
  assigned_grh?: number | null;
}
