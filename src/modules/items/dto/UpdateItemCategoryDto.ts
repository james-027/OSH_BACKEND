import { PartialType } from "@nestjs/mapped-types";
import { CreateItemCategoryDto } from "./CreateItemCategoryDto";

export class UpdateItemCategoryDto extends PartialType(CreateItemCategoryDto) {}
