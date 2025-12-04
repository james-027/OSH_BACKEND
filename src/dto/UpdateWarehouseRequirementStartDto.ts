import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseRequirementStartDto } from "./CreateWarehouseRequirementStartDto";

export class UpdateWarehouseRequirementStartDto extends PartialType(
  CreateWarehouseRequirementStartDto
) {}
