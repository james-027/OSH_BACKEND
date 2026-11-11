import { PartialType } from "@nestjs/mapped-types";
import { CreateSignatoryHeaderDto } from "./CreateSignatoryDto";

export class UpdateSignatoryHeaderDto extends PartialType(CreateSignatoryHeaderDto) {}
