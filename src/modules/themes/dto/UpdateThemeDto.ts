import { PartialType } from "@nestjs/mapped-types";
import { CreateThemeDto } from "./CreateThemeDto";

export class UpdateThemeDto extends PartialType(CreateThemeDto) {}
