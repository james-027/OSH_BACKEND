import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsInt,
  Min,
  IsOptional,
  IsNumber,
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

  @IsOptional()
  @IsInt({ message: "Segment ID must be an integer" })
  @Min(1, { message: "Segment ID must be a positive integer" })
  segment_id?: number;

  @IsOptional()
  @IsInt({ message: "Brand ID must be an integer" })
  @Min(1, { message: "Brand ID must be a positive integer" })
  brand_id?: number;

  @IsNotEmpty({ message: "Address is required" })
  @IsString({ message: "Address must be a string" })
  @MaxLength(255, { message: "Address cannot be longer than 255 characters" })
  address!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "REM Status ID must be an integer" })
  @Min(1, { message: "REM Status ID must be a positive integer" })
  rem_status_id?: number;

  @IsOptional()
  @IsInt({ message: "POS Availability ID must be an integer" })
  @Min(1, { message: "POS Availability ID must be a positive integer" })
  pos_availability_id?: number;

  @IsOptional()
  @IsNumber({}, { message: "Allowance must be a valid number" })
  allowance?: number;

  @IsOptional()
  @IsString({ message: "Start operation must be a string date (YYYY-MM-DD)" })
  start_operation?: string;

  @IsOptional()
  @IsString({ message: "End operation must be a string date (YYYY-MM-DD)" })
  end_operation?: string;

  @IsOptional()
  @IsString({ message: "Starting time must be a string time (HH:MM:SS)" })
  starting_time?: string;

  @IsOptional()
  @IsString({ message: "Ending time must be a string time (HH:MM:SS)" })
  ending_time?: string;

  @IsOptional()
  @IsNumber({}, { message: "Latitude must be a valid number" })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: "Longitude must be a valid number" })
  longitude?: number;

  @IsOptional()
  @IsInt()
  access_key_id?: number;
}

