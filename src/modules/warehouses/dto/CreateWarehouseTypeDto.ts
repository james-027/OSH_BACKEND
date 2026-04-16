import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateWarehouseTypeDto {
  @IsNotEmpty({ message: "Warehouse type name is required" })
  @IsString({ message: "Warehouse type name must be a string" })
  @MaxLength(255, {
    message: "Warehouse type name cannot be longer than 255 characters",
  })
  warehouse_type_name!: string;

  @IsNotEmpty({ message: "Warehouse type abbreviation is required" })
  @IsString({ message: "Warehouse type abbreviation must be a string" })
  @MaxLength(50, {
    message: "Warehouse type abbreviation cannot be longer than 50 characters",
  })
  warehouse_type_abbr!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;
}
