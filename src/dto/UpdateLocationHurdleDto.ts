import { PartialType } from "@nestjs/mapped-types";
import { CreateLocationHurdleDto } from "./CreateLocationHurdleDto";
export class UpdateLocationHurdleDto extends PartialType(
  CreateLocationHurdleDto,
) {
  location_ids?: number[];
  item_category_ids?: number[];
}
