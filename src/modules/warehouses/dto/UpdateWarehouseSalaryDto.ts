import { PartialType } from "@nestjs/mapped-types";
import { CreateWarehouseSalaryDto } from "./CreateWarehouseSalaryDto";

export class UpdateWarehouseSalaryDto extends PartialType(
  CreateWarehouseSalaryDto,
) {}
