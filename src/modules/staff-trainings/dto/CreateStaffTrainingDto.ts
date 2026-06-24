import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsString,
} from "class-validator";
import { CreateStaffTrainingItemDto } from "./CreateStaffTrainingItemDto";

export class CreateStaffTrainingDto {
  @IsInt()
  @IsNotEmpty()
  staff_id!: number;

  @IsBoolean()
  isDraft!: boolean;

  @IsString()
  @IsNotEmpty()
  saveAction!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStaffTrainingItemDto)
  trainings!: CreateStaffTrainingItemDto[];

  @IsOptional()
  @IsInt()
  status_id?: number;
}