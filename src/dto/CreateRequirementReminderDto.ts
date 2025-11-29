import { IsInt, IsOptional } from "class-validator";

export class CreateRequirementReminderDto {
  @IsInt()
  requirement_id!: number;

  @IsInt()
  reminder_type_id!: number;

  @IsInt()
  reminder_count_day!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
