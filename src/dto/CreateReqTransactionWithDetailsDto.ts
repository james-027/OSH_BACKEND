import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

export class FileWithContent {
  @IsString()
  filename: string;

  @IsString()
  buffer: string; // base64 encoded or file content
}

export class CreateReqTransactionWithDetailsDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  warehouse_ids: number[];

  @IsInt()
  requirement_id: number;

  @IsInt()
  renewal_type_id: number; // 1=ONE_TIME, 2=ANNUAL, 3=QUARTERLY, 4=MONTHLY

  @IsOptional()
  @IsString()
  transaction_date?: string; // format: YYYY, YYYY-MM, or YYYY-MM-DD depending on renewal_type

  @IsOptional()
  @IsInt()
  quarter?: number; // 1-4, only for QUARTERLY

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  start_date?: string; // format: YYYY-MM-DD, for Type 2 (Rental) single-warehouse upload

  @IsOptional()
  @IsString()
  end_date?: string; // format: YYYY-MM-DD, for Type 2 (Rental) single-warehouse upload

  @IsOptional()
  @IsInt()
  supplier_id?: number; // Required when requirement_type_id = 2 (Rental)

  @IsOptional()
  @IsNumber()
  contract_amount?: number; // Required when requirement_type_id = 2 (Rental)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileWithContent)
  files: FileWithContent[];
}
