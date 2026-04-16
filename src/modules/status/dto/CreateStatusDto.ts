import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateStatusDto {
  @IsNotEmpty({ message: "Status name is required" })
  @IsString({ message: "Status name must be a string" })
  @MaxLength(100, {
    message: "Status name cannot be longer than 100 characters",
  }) // Example max length
  status_name!: string;
}
