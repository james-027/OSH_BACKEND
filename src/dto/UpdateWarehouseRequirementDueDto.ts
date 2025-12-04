import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseRequirementDueDto } from "./CreateWarehouseRequirementDueDto";

export class UpdateWarehouseRequirementDueDto extends PartialType(
  CreateWarehouseRequirementDueDto
) {}
