import { IsInt, IsString } from "class-validator";

export class CreateSystemDocumentationDto {
  @IsInt()
  system_id: number;

  @IsInt()
  status_id?: number;
  // file_name and file_path are set from uploaded file in controller, not from request body
  @IsString()
  file_name?: string;

  @IsString()
  file_path?: string;
}
