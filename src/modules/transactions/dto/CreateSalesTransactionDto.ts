import {
  IsString,
  IsNumber,
  IsDecimal,
  IsOptional,
  IsInt,
  IsDateString,
} from "class-validator";

export class CreateSalesTransactionDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsDateString()
  doc_date: string;

  @IsString()
  @IsNumber()
  doc_date_month: number;

  @IsString()
  bc_code: string;

  @IsString()
  division: string;

  @IsString()
  whs_code: string;

  @IsString()
  whs_name: string;

  @IsString()
  dchannel: string;

  @IsString()
  item_code: string;

  @IsString()
  item_desc: string;

  @IsString()
  vat_cdoe: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  gross_sales: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  net_sales: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  converted_quantity: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  line_total: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  unit_price: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  vat_amount: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  line_cost: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  item_cost: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  disc_amount: number;

  @IsNumber({ maxDecimalPlaces: 6 })
  vat_rate: number;

  @IsString()
  cat01: string;

  @IsString()
  cat02: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  sales_conv: number;

  @IsNumber()
  sales_unit_eq: number;

  @IsString()
  item_group: string;

  @IsString()
  uom: string;

  @IsInt()
  access_key_id: number;

  @IsInt()
  status_id: number;
}
