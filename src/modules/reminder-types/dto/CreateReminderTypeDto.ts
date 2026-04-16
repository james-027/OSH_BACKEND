import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateReminderTypeDto {
  @IsString()
  @IsNotEmpty()
  reminder_type_name!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
