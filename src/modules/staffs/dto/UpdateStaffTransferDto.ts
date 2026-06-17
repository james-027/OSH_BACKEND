import { IsNumber } from "class-validator";

export class UpdateStaffTransferDto {
  @IsNumber()
  vendor_id: number;
  @IsNumber()
  location_id: number;
}