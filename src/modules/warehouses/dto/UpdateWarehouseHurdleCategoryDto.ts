import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseHurdleCategoryDto } from "./CreateWarehouseHurdleCategoryDto";

export class UpdateWarehouseHurdleCategoryDto extends PartialType(
  CreateWarehouseHurdleCategoryDto,
) {
  warehouse_hurdle_id?: number;
}
