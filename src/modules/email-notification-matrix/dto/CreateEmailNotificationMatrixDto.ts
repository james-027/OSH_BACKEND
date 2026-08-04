import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { CreateEmailNotificationMatrixDetailsDto } from "./CreateEmailNotificationMatrixDetailsDto";

export class CreateEmailNotificationMatrixDto {
  @IsOptional()
  @IsNumber()
  id?: number;

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEmailNotificationMatrixDetailsDto)
  lines!: CreateEmailNotificationMatrixDetailsDto[];

  @IsOptional()
  access_key_id?: number;

  @IsOptional()
  status_id?: number;
}
