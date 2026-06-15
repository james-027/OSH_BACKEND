import { Type } from "class-transformer";
import {
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsNumber,
  IsString,
  IsOptional,
} from "class-validator";

import { UpdateApprovalMatrixDetailsDto } from "./UpdateApprovalMatrixDetailsDto";

export class UpdateApprovalMatrixDto {
  @IsOptional()
  @IsNumber()
  status_id?: number;

  @IsString()
  userid: string;

  @IsNumber()
  isdeleted: number; // flag to indicate if the header is marked for deletion

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateApprovalMatrixDetailsDto)
  lines!: UpdateApprovalMatrixDetailsDto[];

  @IsOptional()
  access_key_id?: number;

  @IsOptional()
  createdBy?: number;
}