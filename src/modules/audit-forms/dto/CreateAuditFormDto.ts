import {
  IsNotEmpty,
  IsString,
  Length,
  IsOptional,
  IsNumber,
} from "class-validator";

export class CreateAuditFormDto {
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  audit_form_name: string;


  @IsOptional()
  @IsNumber()
  status_id?: number;
}
