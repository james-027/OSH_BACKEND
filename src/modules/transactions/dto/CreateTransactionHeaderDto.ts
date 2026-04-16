import { IsDateString, IsInt, IsOptional } from "class-validator";

export class CreateTransactionHeaderDto {
  @IsDateString()
  trans_date: string;

  @IsInt()
  location_id: number;

  @IsInt()
  @IsOptional()
  status_id?: number;

  @IsInt()
  access_key_id: number;

  @IsInt()
  @IsOptional()
  created_by?: number;

  @IsInt()
  @IsOptional()
  updated_by?: number;
}
