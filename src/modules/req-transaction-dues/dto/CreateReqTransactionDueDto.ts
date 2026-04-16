import { IsInt, IsOptional } from "class-validator";

export class CreateReqTransactionDueDto {
  @IsInt()
  req_transaction_header_id!: number;

  @IsInt()
  warehouse_requirement_due_id!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
