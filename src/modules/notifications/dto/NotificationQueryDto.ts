import { IsOptional, IsInt, IsBoolean, IsString, Min } from "class-validator";
import { Type, Transform } from "class-transformer";

export class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true || value === 1 || value === "1")
  @IsBoolean()
  unread_only?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class AdminNotificationAuditDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  module_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  access_key_id?: number;

  @IsOptional()
  @IsString()
  event_code?: string;

  @IsOptional()
  @IsString()
  read_status?: "all" | "read" | "unread" | "partial";

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}
