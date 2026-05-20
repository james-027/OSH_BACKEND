import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from "class-validator";

export class CreateSupplierDto {
  @IsNotEmpty({
    message: "Supplier code is required",
  })
  @IsString({
    message: "Supplier code must be a string",
  })
  @MaxLength(100, {
    message:
      "Supplier code cannot be longer than 100 characters",
  })
  supplier_code!: string;

  @IsOptional()
  @IsString({
    message: "Supplier name must be a string",
  })
  @MaxLength(255, {
    message:
      "Supplier name cannot be longer than 255 characters",
  })
  supplier_name?: string;

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
  @IsInt({
    message: "Status ID must be an integer",
  })
  @Min(1, {
    message:
      "Status ID must be a positive integer",
  })
  status_id?: number;
}