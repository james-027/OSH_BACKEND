import { CreateAuditFormDto } from "./CreateAuditFormDto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateAuditFormDto extends PartialType(CreateAuditFormDto) {}
