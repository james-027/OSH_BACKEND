import { IsNotEmpty, IsString, IsInt } from "class-validator";

export class CreateThemeDto {
  @IsNotEmpty({ message: "Theme name is required" })
  @IsString({ message: "Theme name must be a string" })
  theme_name!: string;

  @IsNotEmpty({ message: "Theme abbreviation is required" })
  @IsString({ message: "Theme abbreviation must be a string" })
  theme_abbr!: string;

  @IsNotEmpty({ message: "Status ID is required" })
  @IsInt({ message: "Status ID must be an integer" })
  status_id?: number;
}
