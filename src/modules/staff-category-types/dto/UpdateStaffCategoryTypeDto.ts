import { PartialType } from "@nestjs/mapped-types";
import { CreateStaffCategoryTypeDto } from "./CreateStaffCategoryTypeDto";

export class UpdateStaffCategoryTypeDto extends PartialType(
  CreateStaffCategoryTypeDto,
) {}
