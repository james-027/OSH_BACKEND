import { PartialType } from "@nestjs/mapped-types";
import { CreateAuditFormDetailsDto } from "./CreateAuditFormDetailsDto";

export class UpdateAuditFormDetailsDto extends PartialType(CreateAuditFormDetailsDto) {}
