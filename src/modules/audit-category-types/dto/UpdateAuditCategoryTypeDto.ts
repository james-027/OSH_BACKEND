import { PartialType } from "@nestjs/mapped-types";
import { CreateAuditCategoryTypeDto } from "./CreateAuditCategoryTypeDto";

export class UpdateAuditCategoryTypeDto extends PartialType(CreateAuditCategoryTypeDto) {}
