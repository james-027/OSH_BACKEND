import { PartialType } from "@nestjs/mapped-types";
import { CreateReminderTypeDto } from "./CreateReminderTypeDto";

export class UpdateReminderTypeDto extends PartialType(CreateReminderTypeDto) {}
