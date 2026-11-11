import { PartialType } from "@nestjs/mapped-types";
import { CreateSignatoryDetailDto } from "./CreateSignatoryDto";

export class UpdateSignatoryDetailDto extends PartialType(CreateSignatoryDetailDto) {}
