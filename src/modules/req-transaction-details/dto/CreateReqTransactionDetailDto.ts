import { IsString, IsInt, IsOptional } from "class-validator";

export class CreateReqTransactionDetailDto {
  @IsInt()
  req_transaction_header_id!: number;

  @IsString()
  requirement_file_path: string;

  @IsString()
  requirement_file_name: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
