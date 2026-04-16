import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseTypeDto } from "./CreateWarehouseTypeDto";

export class UpdateWarehouseTypeDto extends PartialType(
  CreateWarehouseTypeDto,
) {}
