import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { UpdateEmailNotificationMatrixDetailsDto } from "./UpdateEmailNotificationMatrixDetailsDto";

export class UpdateEmailNotificationMatrixDto {
  @IsOptional()
  @IsNumber()
  status_id?: number;

  @Type(() => Number)
  @IsNumber()
  module: number;

  @IsOptional()
  @IsString()
  smtp_email?: string;

  @IsOptional()
  @IsString()
  smtp_server?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  smtp_port?: number;

  @IsOptional()
  @IsString()
  smtp_security?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  smtp_auth_method?: number;

  @IsOptional()
  @IsString()
  smtp_username?: string;

  @IsOptional()
  @IsString()
  smtp_password?: string;

  @IsNumber()
  isdeleted: number; // flag to indicate if the header is marked for deletion

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateEmailNotificationMatrixDetailsDto)
  lines!: UpdateEmailNotificationMatrixDetailsDto[];

  @IsOptional()
  access_key_id?: number;

  @IsOptional()
  createdBy?: number;
}
