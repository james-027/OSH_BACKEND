import { PartialType } from "@nestjs/mapped-types";
import { CreateWorkingDayDto } from "./CreateWorkingDayDto";

export class UpdateWorkingDayDto extends PartialType(CreateWorkingDayDto) {}
