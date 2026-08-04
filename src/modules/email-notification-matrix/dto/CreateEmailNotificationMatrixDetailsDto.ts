import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsString,
  IsOptional,
  IsNumber,
} from "class-validator";

import { CreateEmailNotificationMatrixRecipientsDto } from "./CreateEmailNotificationMatrixRecipientsDto";

export class CreateEmailNotificationMatrixDetailsDto {
  @IsOptional()
  @IsNumber()
  id?: number;

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
  @Type(() => Number)
  @IsNumber()
  is_approval_matrix?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmailNotificationMatrixRecipientsDto)
  recipients!: CreateEmailNotificationMatrixRecipientsDto[];

  @IsOptional()
  status_id?: number;
}
