import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffTrainingDto } from "./CreateStaffTrainingDto";
import { IsInt, IsOptional } from "class-validator";

export class UpdateStaffTrainingDto extends PartialType(
  CreateStaffTrainingDto,
) {}