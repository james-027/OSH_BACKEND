import { PartialType } from "@nestjs/mapped-types";
import { CreateRequirementDto } from "./CreateRequirementDto";

export class UpdateRequirementDto extends PartialType(CreateRequirementDto) {}
