import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateRequirementTypeDto {
  @IsString()
  @IsNotEmpty()
  requirement_type_name!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
