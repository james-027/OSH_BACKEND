import { IsOptional, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";

export class QueryCrewHubMaterialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type_id?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  include_inactive?: string;
}

export class QueryCrewHubSystemDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  include_inactive?: string;
}

