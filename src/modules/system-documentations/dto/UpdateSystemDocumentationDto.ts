import { PartialType } from "@nestjs/mapped-types";
import { CreateSystemDocumentationDto } from "./CreateSystemDocumentationDto";

export class UpdateSystemDocumentationDto extends PartialType(
  CreateSystemDocumentationDto,
) {}
