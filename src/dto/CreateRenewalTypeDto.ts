import { IsString, IsNotEmpty, IsInt, IsOptional } from "class-validator";

export class CreateRenewalTypeDto {
  @IsString()
  @IsNotEmpty()
  renewal_type_name!: string;

  @IsOptional()
  @IsInt()
  status_id?: number;
}
