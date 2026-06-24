import { IsNumber,IsString } from "class-validator";

export class UpdateStaffTransferDto {
  @IsNumber()
  vendor_id: number;
  @IsNumber()
  location_id: number;

  @IsString()
  effectivity_date: string;
}