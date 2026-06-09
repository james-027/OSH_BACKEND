import {
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
  ArrayMinSize,
  isDate,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class FileWithContent {
  @IsString()
  filename: string;

  @IsString()
  buffer: string; // base64 encoded file content
}

export class UploadMultipleDetailsDto {
  @IsInt()
  req_transaction_header_id!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => FileWithContent)
  files: FileWithContent[];

  @IsOptional()
  @IsString()
  warehouse_requirement_due_start?: string; // format: YYYY-MM-DD, for Type 2 (Rental) single-warehouse upload

  @IsOptional()
  @IsString()
  warehouse_requirement_due_end?: string; // format: YYYY-MM-DD, for Type 2 (Rental) single-warehouse upload
}
