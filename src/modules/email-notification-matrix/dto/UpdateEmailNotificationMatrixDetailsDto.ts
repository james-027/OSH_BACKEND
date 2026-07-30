import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { UpdateEmailNotificationMatrixRecipientsDto } from "./UpdateEmailNotificationMatrixRecipientsDto";

export class UpdateEmailNotificationMatrixDetailsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsNumber()
  isdeleted: number;

  @IsString()
  email_title: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  module?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  trigger_status_id?: number;

  @IsOptional()
  @IsString()
  email_format?: string;

  @IsOptional()
  @IsNumber()
  status_id?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateEmailNotificationMatrixRecipientsDto)
  recipients!: UpdateEmailNotificationMatrixRecipientsDto[];
}
