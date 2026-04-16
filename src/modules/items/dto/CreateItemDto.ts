import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  IsDecimal,
} from "class-validator";

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  item_code: string;

  @IsString()
  @IsNotEmpty()
  item_name: string;

  @IsString()
  @IsNotEmpty()
  item_group: string;

  @IsString()
  @IsNotEmpty()
  uom: string;

  @IsString()
  @IsNotEmpty()
  uom_sa: string;

  @IsOptional()
  @IsNumber()
  category1_id?: number;

  @IsOptional()
  @IsNumber()
  category2_id?: number;

  @IsNotEmpty()
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: "sales_conv must be a decimal number" }
  )
  sales_conv: number;

  @IsNotEmpty()
  @IsNumber(
    { maxDecimalPlaces: 6 },
    { message: "sales_unit_eq must be a decimal number" }
  )
  sales_unit_eq: number;

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
