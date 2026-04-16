import { PartialType } from "@nestjs/mapped-types";
import { CreateItemDto } from "./CreateItemDto";

export class UpdateItemDto extends PartialType(CreateItemDto) {}
