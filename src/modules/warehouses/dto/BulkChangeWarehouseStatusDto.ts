import {
  IsArray,
  ArrayNotEmpty,
  IsInt,
  Min,
  IsIn,
  IsOptional,
  IsString,
} from "class-validator";
import { STATUS_IDS } from "src/constants/customConstants";

export class BulkChangeWarehouseStatusDto {
  @IsArray({ message: "IDs must be an array" })
  @ArrayNotEmpty({ message: "IDs array must not be empty" })
  @IsInt({ each: true, message: "Each ID must be an integer" })
  @Min(1, { each: true, message: "Each ID must be a positive integer" })
  ids!: number[];

  @IsInt({ message: "Status ID must be an integer" })
  @IsIn(
    [
      STATUS_IDS.OPEN,
      STATUS_IDS.SOON_TO_OPEN,
      STATUS_IDS.PERMANENT_CLOSED,
      STATUS_IDS.CANCELLED_DECLINED,
      STATUS_IDS.TEMPORARY_CLOSED,
    ],
    {
      message:
        "Status ID must be a valid REM status (8: OPEN, 9: SOON_TO_OPEN, 10: PERMANENT_CLOSED, 11: CANCELLED_DECLINED, 12: TEMPORARY_CLOSED)",
    },
  )
  rem_status_id!: number;

  @IsOptional()
  @IsString({ message: "Undo/status reason must be a string" })
  undo_reason?: string;

  @IsOptional()
  @IsString({ message: "Remarks must be a string" })
  remarks?: string;
}
