import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ArrayMinSize,
} from "class-validator";

export class BulkAttendanceStatusDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one Schedule Header ID is required." })
  @IsInt({ each: true, message: "Each ID must be an integer." })
  @IsNotEmpty({ message: "id array cannot be empty." })
  id: number[];

  @IsInt({ message: "status_id must be an integer." })
  @IsNotEmpty({ message: "status_id is required." })
  status_id: number;

  @IsOptional()
  @IsString({ message: "remarks must be a string." })
  remarks?: string;
}

