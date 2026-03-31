import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffVendorSalaryDto } from "./CreateStaffVendorSalaryDto";

export class UpdateStaffVendorSalaryDto extends PartialType(
  CreateStaffVendorSalaryDto,
) {}
