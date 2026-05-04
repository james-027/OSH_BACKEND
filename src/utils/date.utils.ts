/**
 * Format Date to YYYY-MM-DD string using local date (not UTC)
 * Avoids timezone issues that occur with toISOString()
 * @param date Date object to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get current timestamp in local timezone (ISO-8601 format with timezone offset)
 * Fixes issue where toISOString() returns UTC, causing timezone mismatch
 * @returns Timestamp like "2026-03-15T18:44:39.748+08:00"
 */
export function getLocalISOTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");

  // Calculate timezone offset
  const tzOffset = now.getTimezoneOffset();
  const tzHours = Math.abs(Math.floor(tzOffset / 60));
  const tzMinutes = Math.abs(tzOffset % 60);
  const tzSign = tzOffset <= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(tzMinutes).padStart(2, "0")}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzString}`;
}

/**
 * Get current timestamp in local timezone (ISO-8601 format with timezone offset)
 * Fixes issue where toISOString() returns UTC, causing timezone mismatch
 * @param date Date object to format
 * @returns Timestamp like "2026-03-15T18:44:39.748+08:00"
 */
export function getLocalISOTimestampFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  // Calculate timezone offset
  const tzOffset = date.getTimezoneOffset();
  const tzHours = Math.abs(Math.floor(tzOffset / 60));
  const tzMinutes = Math.abs(tzOffset % 60);
  const tzSign = tzOffset <= 0 ? "+" : "-";
  const tzString = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(tzMinutes).padStart(2, "0")}`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${tzString}`;
}

/**
 * Validate that a date string is a REAL calendar date (timezone-independent)
 * Respects local time - no UTC conversion
 * @param dateString Date string in YYYY-MM-DD format
 * @returns true if date is valid, false if invalid (e.g., 2026-11-31)
 *
 * @example
 * isValidCalendarDate('2026-11-30') // true
 * isValidCalendarDate('2026-11-31') // false - November has 30 days
 * isValidCalendarDate('2026-02-29') // false - 2026 is not a leap year
 * isValidCalendarDate('2024-02-29') // true - 2024 is a leap year
 */
export function isValidCalendarDate(dateString: string): boolean {
  const parts = dateString.split("-");
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Validate month range
  if (month < 1 || month > 12) return false;

  // Days in each month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Check for leap year
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (isLeapYear) {
    daysInMonth[1] = 29; // February has 29 days in leap year
  }

  // Check if day is valid for the given month
  return day >= 1 && day <= daysInMonth[month - 1];
}
