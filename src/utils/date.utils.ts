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
