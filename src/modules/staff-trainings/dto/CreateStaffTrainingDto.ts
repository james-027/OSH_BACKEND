import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { CreateStaffTrainingItemDto } from "./CreateStaffTrainingItemDto";

export class CreateStaffTrainingDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStaffTrainingItemDto)
  trainings!: CreateStaffTrainingItemDto[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}