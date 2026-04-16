import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffWarehouseDto } from "./CreateStaffWarehouseDto";

export class UpdateStaffWarehouseDto extends PartialType(
  CreateStaffWarehouseDto,
) {}
