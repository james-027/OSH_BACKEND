import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffTrainingDto } from "./CreateStaffTrainingDto";

export class UpdateStaffTrainingDto extends PartialType(
  CreateStaffTrainingDto,
) {}
