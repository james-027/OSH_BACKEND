import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

/**
 * PosVoucherRelayDto
 *
 * Hardened strict DTO for incoming POS voucher requests destined for the legacy PHP API.
 * With whitelist: true and forbidNonWhitelisted: true:
 * - Any unexpected fields (e.g. PHP_SESSION_UPLOAD_PROGRESS or misspelled keys) are rejected with HTTP 400.
 * - Regex constraints ensure no SQL quotes, command injection characters, or scripts can enter.
 */
export class PosVoucherRelayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: "X-API-KEY contains invalid characters",
  })
  "X-API-KEY": string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "originator must contain only alphanumeric characters, hyphens, or underscores",
  })
  originator: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Matches(/^[0-9]+$/, {
    message: "outlet_ifs must contain digits only",
  })
  outlet_ifs: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "crew_code format is invalid",
  })
  crew_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9#!_\-]+$/, {
    message: "voucher_code contains invalid characters",
  })
  voucher_code: string;

  @IsOptional()
  @Transform(({ value }) => {
    // Kung ipinasa ang literal na DOM element string or garbage frontend placeholder, gawing null
    if (
      typeof value === "string" &&
      value.trim() === "[object HTMLInputElement]"
    ) {
      return null;
    }
    return value;
  })
  @ValidateIf((_, val) => val !== null && val !== undefined && val !== "")
  @IsString()
  @MaxLength(255)
  @Matches(/^[\p{L}\p{N}\s.,'#_/\-]*$/u, {
    message: "added_info contains invalid characters",
  })
  added_info?: string | null;
}
