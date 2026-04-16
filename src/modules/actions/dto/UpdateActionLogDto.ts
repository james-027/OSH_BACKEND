import { PartialType } from "@nestjs/mapped-types";
import { CreateActionLogDto } from "./CreateActionLogDto";

export class UpdateActionLogDto extends PartialType(CreateActionLogDto) {}
