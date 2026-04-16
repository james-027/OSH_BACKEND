import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseHurdleDto } from "./CreateWarehouseHurdleDto";

export class UpdateWarehouseHurdleDto extends PartialType(
  CreateWarehouseHurdleDto,
) {
  warehouse_ids?: number[];
  item_category_ids?: number[];
}
