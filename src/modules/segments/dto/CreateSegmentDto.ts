import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class CreateSegmentDto {
  @IsNotEmpty({ message: "Segment name is required" })
  @IsString({ message: "Segment name must be a string" })
  @MaxLength(255, {
    message: "Segment name cannot be longer than 255 characters",
  })
  segment_name!: string;

  @IsNotEmpty({ message: "Segment abbreviation is required" })
  @IsString({ message: "Segment abbreviation must be a string" })
  @MaxLength(50, {
    message: "Segment abbreviation cannot be longer than 50 characters",
  })
  segment_abbr!: string;

  @IsOptional()
  @IsInt({ message: "Status ID must be an integer" })
  @Min(1, { message: "Status ID must be a positive integer" })
  status_id?: number;

  @IsOptional()
  @IsInt({ message: "Brand ID must be an integer" })
  @Min(1, { message: "Brand ID must be a positive integer" })
  brand_id?: number;
}

export default CreateSegmentDto;
