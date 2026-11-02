import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";

export class CreateNotificationMatrixRecipientDto {
  @IsInt()
  @IsNotEmpty()
  role_id: number;

  @IsOptional()
  @IsInt()
  user_id?: number | null;

  @IsOptional()
  @IsInt()
  status_id?: number;
}

export class CreateNotificationMatrixDto {
  @IsInt()
  @IsNotEmpty()
  module_id: number;

  @IsString()
  @IsNotEmpty()
  event_code: string;

  @IsString()
  @IsNotEmpty()
  event_name: string;

  @IsOptional()
  @IsString()
  title_template?: string;

  @IsOptional()
  @IsString()
  description_template?: string;

  @IsOptional()
  @IsString()
  action_url?: string;

  @IsOptional()
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateNotificationMatrixRecipientDto)
  recipients?: CreateNotificationMatrixRecipientDto[];
}

export class UpdateNotificationMatrixDto extends PartialType(
  CreateNotificationMatrixDto,
) {}

