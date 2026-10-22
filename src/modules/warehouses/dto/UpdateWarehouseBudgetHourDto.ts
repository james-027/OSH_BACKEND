import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseBudgetHourDto } from "./CreateWarehouseBudgetHourDto";

export class UpdateWarehouseBudgetHourDto extends PartialType(
  CreateWarehouseBudgetHourDto,
) {}
