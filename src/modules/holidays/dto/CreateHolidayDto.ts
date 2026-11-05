import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateHolidayDto {

  @IsNotEmpty({ message: "Holiday name is required" })
  @IsString({ message: "Holiday name must be a string" })
  @MaxLength(255, {
    message: "Holiday name cannot be longer than 255 characters",
  })
  description!: string;

  @IsOptional()
  @IsString({ message: "Holiday date must be a string" })
  holiday_date?: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "Working day ID must be an integer" })
  @Min(1, { message: "Working day ID must be a positive integer" })
  working_day_id?: number;
}
