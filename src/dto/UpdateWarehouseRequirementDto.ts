import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseRequirementDto } from "./CreateWarehouseRequirementDto";

export class UpdateWarehouseRequirementDto extends PartialType(
  CreateWarehouseRequirementDto
) {}
