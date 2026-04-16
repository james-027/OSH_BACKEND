import { IsString, IsNumber, IsInt, IsDateString } from "class-validator";

export class CreateSalesBudgetTransactionDto {
  @IsString()
  bc_name: string;

  @IsString()
  bc_code: string;

  @IsString()
  ifs_code: string;

  @IsString()
  outlet_name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  sales_det_qty: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  sales_det_qty_2: number;

  @IsInt()
  sales_month: number;

  @IsDateString()
  sales_date: string;

  @IsInt()
  status_id: number;

  @IsInt()
  access_key_id: number;
}
