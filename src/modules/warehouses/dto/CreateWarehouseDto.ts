import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsInt,
  Min,
  IsOptional,
} from "class-validator";

export class CreateWarehouseDto {
  @IsNotEmpty({ message: "Warehouse name is required" })
  @IsString({ message: "Warehouse name must be a string" })
  @MaxLength(255, {
    message: "Warehouse name cannot be longer than 255 characters",
  })
  warehouse_name!: string;

  @IsNotEmpty({ message: "Warehouse IFS is required" })
  @IsString({ message: "Warehouse IFS must be a string" })
  @MaxLength(100, {
    message: "Warehouse IFS cannot be longer than 100 characters",
  })
  warehouse_ifs!: string;

  @IsNotEmpty({ message: "Warehouse code is required" })
  @IsString({ message: "Warehouse code must be a string" })
  @MaxLength(100, {
    message: "Warehouse code cannot be longer than 100 characters",
  })
  warehouse_code!: string;

  @IsInt({ message: "Warehouse type ID must be an integer" })
  @Min(1, { message: "Warehouse type ID must be a positive integer" })
  warehouse_type_id!: number;

  @IsInt({ message: "Location ID must be an integer" })
  @Min(1, { message: "Location ID must be a positive integer" })
  location_id!: number;

  @IsInt({ message: "Brand ID must be an integer" })
  @Min(1, { message: "Brand ID must be a positive integer" })
  brand_id!: number;

  @IsNotEmpty({ message: "Address is required" })
  @IsString({ message: "Address must be a string" })
  @MaxLength(255, { message: "Address cannot be longer than 255 characters" })
  address!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;
}
