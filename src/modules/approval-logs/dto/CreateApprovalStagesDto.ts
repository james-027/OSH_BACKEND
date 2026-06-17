import { Type } from "class-transformer";
import { IsNumber, IsString, IsDateString } from "class-validator";

export class CreateApprovalStagesDto {
  @Type(() => Number)
  @IsNumber()
  transaction_id: number;

  @Type(() => Number)
  @IsNumber()
  module_id: number;

  @IsString()
  document_number: string;

  @IsDateString()
  transaction_date: Date;

  @IsNumber()
  approval_id: number;
}
