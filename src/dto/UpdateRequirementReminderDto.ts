import { PartialType } from "@nestjs/mapped-types";
import { CreateRequirementReminderDto } from "./CreateRequirementReminderDto";

export class UpdateRequirementReminderDto extends PartialType(
  CreateRequirementReminderDto
) {}
