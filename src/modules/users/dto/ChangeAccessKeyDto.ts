import { IsNotEmpty, IsNumber } from "class-validator";

export class ChangeAccessKeyDto {
  @IsNumber({}, { message: "Access key ID must be a number" })
  @IsNotEmpty({ message: "Access key ID is required" })
  access_key_id: number;

  @IsNumber({}, { message: "Role ID must be a number" })
  @IsNotEmpty({ message: "Role ID is required" })
  role_id: number;
}
