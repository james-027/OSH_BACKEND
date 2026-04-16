export class CreateUserAuditTrailDto {
  service: string;
  method: string;
  raw_data?: string;
  description?: string;
  status_id?: number;
}
