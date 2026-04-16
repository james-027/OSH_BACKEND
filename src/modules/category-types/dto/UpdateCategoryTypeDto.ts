import { PartialType } from "@nestjs/mapped-types";
import { CreateCategoryTypeDto } from "./CreateCategoryTypeDto";

export class UpdateCategoryTypeDto extends PartialType(CreateCategoryTypeDto) {}
