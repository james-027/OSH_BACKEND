export class CreateSystemDocumentationDto {
  system_id: number;
  status_id?: number;
  // file_name and file_path are set from uploaded file in controller, not from request body
  file_name?: string;
  file_path?: string;
}
