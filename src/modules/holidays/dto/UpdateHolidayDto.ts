import { PartialType } from "@nestjs/mapped-types";
import { CreateHolidayDto } from "./CreateHolidayDto";

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
