import { PartialType } from "@nestjs/mapped-types";
import { CreateLocationHurdleCategoryDto } from "./CreateLocationHurdleCategoryDto";

export class UpdateLocationHurdleCategoryDto extends PartialType(
  CreateLocationHurdleCategoryDto,
) {
  location_hurdle_id?: number;
}
