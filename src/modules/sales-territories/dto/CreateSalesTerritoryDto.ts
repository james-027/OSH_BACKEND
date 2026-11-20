import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateSalesTerritoryDto {
  @IsNotEmpty({ message: "Description is required" })
  @IsString({ message: "Description must be a string" })
  @MaxLength(255, {
    message: "Description cannot be longer than 255 characters",
  })
  description!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "Access key ID must be an integer" })
  access_key_id?: number;
}

export default CreateSalesTerritoryDto;
