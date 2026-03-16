import { BadRequestException } from "@nestjs/common";

/**
 * Validate and sanitize a date query parameter
 * Accepts format: YYYY-MM-DD (e.g., 2026-10-01)
 * @param dateStr - Date string to validate
 * @param fieldName - Name of the field (for error messages)
 * @throws BadRequestException if invalid format or invalid date
 * @returns Validated ISO date string (YYYY-MM-DD)
 */
export function validateDateParam(
  dateStr: string,
  fieldName: string = "date",
): string {
  if (!dateStr || typeof dateStr !== "string") {
    throw new BadRequestException(`${fieldName} must be a valid string.`);
  }

  // Check format: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr.trim())) {
    throw new BadRequestException(
      `Invalid ${fieldName} format. Expected format: YYYY-MM-DD (e.g., 2026-10-01)`,
    );
  }

  // Validate it's a valid date
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    throw new BadRequestException(
      `Invalid ${fieldName}. Please provide a valid date.`,
    );
  }

  // Return trimmed ISO date format
  return dateStr.trim();
}

/**
 * Validate and sanitize a string query parameter
 * @param str - String to validate
 * @param fieldName - Name of the field (for error messages)
 * @param options - Validation options (minLength, maxLength, pattern)
 * @throws BadRequestException if invalid
 * @returns Sanitized string (trimmed)
 */
export function validateStringParam(
  str: string,
  fieldName: string = "string",
  options?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: string[];
  },
): string {
  if (!str || typeof str !== "string") {
    throw new BadRequestException(`${fieldName} must be a valid string.`);
  }

  const trimmed = str.trim();

  // Check length
  if (options?.minLength && trimmed.length < options.minLength) {
    throw new BadRequestException(
      `${fieldName} must be at least ${options.minLength} characters.`,
    );
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new BadRequestException(
      `${fieldName} must not exceed ${options.maxLength} characters.`,
    );
  }

  // Check pattern
  if (options?.pattern && !options.pattern.test(trimmed)) {
    throw new BadRequestException(`${fieldName} format is invalid.`);
  }

  // Check allowed values
  if (options?.allowedValues && !options.allowedValues.includes(trimmed)) {
    throw new BadRequestException(
      `${fieldName} must be one of: ${options.allowedValues.join(", ")}`,
    );
  }

  return trimmed;
}

/**
 * Validate an enum/select query parameter
 * @param value - Value to validate
 * @param fieldName - Name of the field (for error messages)
 * @param allowedValues - Array of allowed values
 * @throws BadRequestException if not in allowed values
 * @returns Validated value
 */
export function validateEnumParam<T extends string | number>(
  value: T | string,
  fieldName: string = "enum",
  allowedValues: T[],
): T {
  if (allowedValues.includes(value as T)) {
    return value as T;
  }

  throw new BadRequestException(
    `Invalid ${fieldName}. Allowed values: ${allowedValues.join(", ")}`,
  );
}

/**
 * Validate a numeric query parameter
 * @param numStr - Number string to validate
 * @param fieldName - Name of the field (for error messages)
 * @param options - Validation options (min, max, integer)
 * @throws BadRequestException if invalid
 * @returns Validated number
 */
export function validateNumericParam(
  numStr: string,
  fieldName: string = "number",
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  },
): number {
  if (!numStr || typeof numStr !== "string") {
    throw new BadRequestException(
      `${fieldName} must be a valid numeric string.`,
    );
  }

  const num = Number(numStr);

  if (isNaN(num)) {
    throw new BadRequestException(`${fieldName} must be a valid number.`);
  }

  if (options?.integer && !Number.isInteger(num)) {
    throw new BadRequestException(`${fieldName} must be an integer.`);
  }

  if (options?.min !== undefined && num < options.min) {
    throw new BadRequestException(
      `${fieldName} must be at least ${options.min}.`,
    );
  }

  if (options?.max !== undefined && num > options.max) {
    throw new BadRequestException(
      `${fieldName} must not exceed ${options.max}.`,
    );
  }

  return num;
}

/**
 * Validate a date range (start and end dates)
 * @param startDateStr - Start date (YYYY-MM-DD)
 * @param endDateStr - End date (YYYY-MM-DD)
 * @throws BadRequestException if invalid or end before start
 * @returns Object with validated dates
 */
export function validateDateRangeParam(
  startDateStr: string,
  endDateStr: string,
): { startDate: string; endDate: string } {
  const startDate = validateDateParam(startDateStr, "startDate");
  const endDate = validateDateParam(endDateStr, "endDate");

  const startObj = new Date(startDate);
  const endObj = new Date(endDate);

  if (startObj > endObj) {
    throw new BadRequestException("startDate must not be after endDate.");
  }

  return { startDate, endDate };
}
