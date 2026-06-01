import {
  IsString,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateDebitAdviceCategoryDto {
  @IsOptional()
  @IsString({
    message: "Category code must be a string",
  })
  @MaxLength(100, {
    message:
      "Category code cannot be longer than 100 characters",
  })
  category_code?: string;

  @IsOptional()
  @IsString({
    message: "Category name must be a string",
  })
  @MaxLength(255, {
    message:
      "Category name cannot be longer than 255 characters",
  })
  category_name?: string;

  @IsOptional()
  @IsString({
    message: "Old code must be a string",
  })
  @MaxLength(100, {
    message:
      "Old code cannot be longer than 100 characters",
  })
  old_code?: string;

  @IsOptional()
  @IsString({
    message: "Company must be a string",
  })
  @MaxLength(255, {
    message:
      "Company cannot be longer than 255 characters",
  })
  company?: string;

  @IsOptional()
  @IsInt({
    message: "Status ID must be an integer",
  })
  @Min(1, {
    message:
      "Status ID must be a positive integer",
  })
  status_id?: number;
}