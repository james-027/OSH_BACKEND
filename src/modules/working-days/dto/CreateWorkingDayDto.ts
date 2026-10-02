import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsNumber,
} from "class-validator";

export class CreateWorkingDayDto {


  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
