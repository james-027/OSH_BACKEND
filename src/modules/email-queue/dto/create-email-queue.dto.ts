import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateEmailQueueDto {
  @IsNotEmpty()
  @IsString()
  document_number: string;

  @IsNotEmpty()
  @IsNumber()
  transaction_id: number;

  @IsNotEmpty()
  @IsNumber()
  module_id: number;

  @IsNotEmpty()
  @IsNumber()
  trigger_status_id: number;

  @IsOptional()
  @IsString()
  email_subject?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsNumber()
  created_by?: number;
}
