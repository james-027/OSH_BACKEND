import { IsNotEmpty, IsInt } from "class-validator";

export class CreateLocationHurdleCategoryDto {
  @IsNotEmpty()
  @IsInt()
  location_id: number;
  item_category_id: number;

  @IsInt()
  status_id?: number;
  location_hurdle_id?: number;
}
