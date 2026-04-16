import { IsNotEmpty, IsInt } from "class-validator";

export class CreateWarehouseHurdleCategoryDto {
  @IsNotEmpty()
  @IsInt()
  warehouse_id: number;

  @IsNotEmpty()
  @IsInt()
  item_category_id: number;

  @IsInt()
  status_id?: number;

  @IsInt()
  warehouse_hurdle_id?: number;
}
