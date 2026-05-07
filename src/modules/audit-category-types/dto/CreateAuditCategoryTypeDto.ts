import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateAuditCategoryTypeDto {
  @IsInt()
  @IsNotEmpty()
  audit_form_id!: number;

  @IsInt()
  @IsNotEmpty()
  category_type_id!: number;
  
  @IsOptional()
  @IsInt()
  status_id?: number;
}
