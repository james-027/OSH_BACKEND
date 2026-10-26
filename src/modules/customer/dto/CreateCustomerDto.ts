import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCustomerDto {
  @IsNotEmpty({
    message: "Customer code (custno) is required",
  })
  @IsString({
    message: "Customer code must be a string",
  })
  @MaxLength(100, {
    message: "Customer code cannot be longer than 100 characters",
  })
  custno!: string;

  @IsOptional()
  @IsString({
    message: "Customer name must be a string",
  })
  @MaxLength(255, {
    message: "Customer name cannot be longer than 255 characters",
  })
  custname?: string;

  @IsOptional()
  @IsString({
    message: "Customer group must be a string",
  })
  @MaxLength(255)
  customergroup?: string;

  @IsOptional()
  @IsString({
    message: "TIN ID must be a string",
  })
  @MaxLength(255)
  tin_id?: string;

  @IsOptional()
  @IsString({
    message: "Bill-to address must be a string",
  })
  bill_to_address?: string;

  @IsOptional()
  @IsString({
    message: "Ship-to address must be a string",
  })
  ship_to_address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @IsOptional()
  @IsInt({
    message: "Status ID must be an integer",
  })
  @Min(1, {
    message: "Status ID must be a positive integer",
  })
  status_id?: number;
}