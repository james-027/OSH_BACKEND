import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProfitcenterDto {
  @IsNotEmpty({
    message: "Profitcenter code is required",
  })
  @IsString({
    message: "Profitcenter code must be a string",
  })
  @MaxLength(100, {
    message:
      "Profitcenter code cannot be longer than 100 characters",
  })
  profitcenter_code!: string;

  @IsOptional()
  @IsString({
    message: "Profitcenter name must be a string",
  })
  @MaxLength(255, {
    message:
      "Profitcenter name cannot be longer than 255 characters",
  })
  profitcenter_name?: string;

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