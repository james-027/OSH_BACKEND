import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffSalaryDto } from "./CreateStaffSalaryDto";

export class UpdateStaffSalaryDto extends PartialType(
  CreateStaffSalaryDto,
) {}
