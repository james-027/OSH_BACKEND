import { PartialType } from "@nestjs/mapped-types";
import { CreateRequirementTypeDto } from "./CreateRequirementTypeDto";

export class UpdateRequirementTypeDto extends PartialType(
  CreateRequirementTypeDto,
) {}
