import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateRequirementDto {
  @IsString()
  @IsNotEmpty()
  requirement_name!: string;

  @IsInt()
  renewal_type_id!: number;

  @IsInt()
  requirement_reminder!: number;

  @IsInt()
  requirement_start!: number;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
