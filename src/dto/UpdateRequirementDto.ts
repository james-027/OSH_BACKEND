import { PartialType } from "@nestjs/mapped-types";
import {
  IsBoolean,
  IsOptional,
  ValidateIf,
  IsInt,
  Min,
  IsEnum,
} from "class-validator";
import { CreateRequirementDto } from "./CreateRequirementDto";

export enum UpdateStrategy {
  ALL_YEARS = "allYears",
  CURRENT_ONLY = "currentOnly",
}

export class UpdateRequirementDto extends PartialType(CreateRequirementDto) {
  @IsOptional()
  @IsBoolean()
  update_date_details?: boolean;

  @ValidateIf((o) => o.update_date_details === true)
  @IsInt()
  @Min(1900)
  year?: number;

  @IsOptional()
  @IsEnum(UpdateStrategy)
  update_strategy?: UpdateStrategy = UpdateStrategy.ALL_YEARS;
}
