import { IsOptional, IsDateString } from "class-validator";

/**
 * Reusable query params DTO for date filtering
 * Use this in controllers to accept date-based query parameters
 *
 * Example:
 * @Get()
 * findAll(@Query() queryParams: DateFilterQueryDto) {
 *   // queryParams.hurdle_date is validated and optional
 * }
 */
export class DateFilterQueryDto {
  @IsOptional()
  @IsDateString()
  hurdle_date?: string;

  @IsOptional()
  @IsDateString()
  assignment_date?: string;

  @IsOptional()
  @IsDateString()
  sales_date?: string;

  @IsOptional()
  @IsDateString()
  sales_year?: string;
}
