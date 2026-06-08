import { PartialType } from "@nestjs/mapped-types";
import { CreateTrainingDto } from "./CreateTrainingDto";

export class UpdateTrainingDto extends PartialType(CreateTrainingDto) {}
