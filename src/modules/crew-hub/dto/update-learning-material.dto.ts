import { PartialType } from "@nestjs/mapped-types";
import { CreateLearningMaterialDto } from "./create-learning-material.dto";

export class UpdateLearningMaterialDto extends PartialType(
  CreateLearningMaterialDto,
) {}

