import { IsString, IsOptional, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class CreateEmailNotificationMatrixRecipientsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  userid?: number | null;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  recipient_type?: "TO" | "CC";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  is_maker?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  is_cc?: number;

  @IsOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  is_approval_matrix?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  module?: number;

  @IsOptional()
  status_id?: number;
}
