import {
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
} from "class-validator";

/**
 * Reusable query params DTO for pagination
 */
export class PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * Reusable query params DTO for date range filtering
 */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * Reusable query params DTO for sorting
 */
export class SortQueryDto {
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: "ASC" | "DESC" = "ASC";
}

/**
 * Combined query params DTO for common list operations
 */
export class ListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: "ASC" | "DESC" = "ASC";
}

/**
 * Combined query params DTO for warehouse requirement listing
 */
export class WhReqListingDto extends PaginationQueryDto {
  @IsOptional()
  @IsNumber()
  warehouse_id?: number;

  @IsOptional()
  @IsString()
  trans_number?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsBoolean()
  flatten?: boolean;
}
