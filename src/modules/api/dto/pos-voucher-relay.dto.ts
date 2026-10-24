import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * PosVoucherRelayDto
 *
 * Strict DTO for incoming POS voucher requests destined for the legacy PHP API.
 * With whitelist: true and forbidNonWhitelisted: true, any unexpected fields
 * (such as PHP_SESSION_UPLOAD_PROGRESS) will be rejected with HTTP 400.
 */
export class PosVoucherRelayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  "X-API-KEY": string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  originator: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  outlet_ifs: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  crew_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  voucher_code: string;
}
