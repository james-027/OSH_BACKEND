import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateEmailNotificationMatrixRecipientsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  isdeleted: number;

  @Type(() => Number)
  @IsNumber()
  userid: number;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  recipient_type?: "TO" | "CC";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  is_approval_matrix?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  module?: number;

  @IsOptional()
  @IsNumber()
  status_id?: number;
}
