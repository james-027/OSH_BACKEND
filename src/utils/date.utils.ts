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
