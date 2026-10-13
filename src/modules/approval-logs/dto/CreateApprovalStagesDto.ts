import { Type } from "class-transformer";
import { IsNumber, IsString, IsDateString } from "class-validator";
import { Module } from "src/entities/Module";
export class CreateApprovalStagesDto {
  @Type(() => Number)
  @IsNumber()
  transaction_id: number;

  @IsString()
  module_name: string;

  @IsString()
  document_number: string;

  @IsDateString()
  transaction_date: Date;

  @IsNumber()
  approval_id: number;

  @IsNumber()
  requestor_id: number;
}
