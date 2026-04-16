import { CreateActionDto } from "./CreateActionDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateActionDto extends PartialType(CreateActionDto) {}
