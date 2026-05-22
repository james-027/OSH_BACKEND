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

/**
 * Get UTC midnight at the start of a date ("YYYY-MM-DD").
 */
export function startOfLocalDay(dateString: string): Date {
  if (!isValidCalendarDate(dateString)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)); // UTC midnight
}

/**
 * Get UTC time at end of day for the date in "YYYY-MM-DD".
 * For use with an end date to capture up to the same time as 'now' on that day.
 * (If endDate is today, includes everything up to the current UTC time.
 *  If endDate is in past, sets to "23:59:59.999" UTC of that day.)
 */
export function endOfLocalRange(dateString: string): Date {
  if (!isValidCalendarDate(dateString)) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  const [year, month, day] = dateString.split("-").map(Number);
  const today = new Date();
  const nowY = today.getUTCFullYear();
  const nowM = today.getUTCMonth() + 1;
  const nowD = today.getUTCDate();

  if (year === nowY && month === nowM && day === nowD) {
    // If it's today, use current local time as UTC (no timezone conversion)
    const localHours = today.getHours();
    const localMinutes = today.getMinutes();
    const localSeconds = today.getSeconds();
    const localMillis = today.getMilliseconds();
    return new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        localHours,
        localMinutes,
        localSeconds,
        localMillis,
      ),
    );
  } else {
    // Otherwise, use end of the supplied day (UTC)
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  }
}

/**
 * Get current timestamp in UTC ISO-8601 format suitable for storage
 * Always use this for database storage, API responses, and calculations
 * @returns UTC timestamp like "2026-05-06T10:02:46.176Z"
 */
export function getCurrentUTCTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Get current Date object in UTC
 * Returns the current moment as a Date object (always UTC internally)
 * @returns Current Date object representing UTC now
 */
export function getCurrentUTCDate(): Date {
  return new Date();
}

/**
 * Convert a Date object to represent local time (without timezone conversion)
 * Takes local time components and creates a Date that displays those values
 * Useful when you need a Date object representing local time values
 * @param date Date object to convert (reads local time components)
 * @returns Date object representing the same local time values
 * @example
 * const utcDate = new Date("2026-05-07T02:57:13.938Z");  // UTC
 * const localDate = toLocalDateObject(utcDate);
 *
 * utcDate.getHours()   // 10 (Manila time)
 * localDate.getHours() // 10 (same value, no conversion needed)
 *
 * localDate.toISOString() // "2026-05-07T10:57:13.938Z"
 */
export function toLocalDateObject(date: Date = new Date()): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  // Create new Date using local time values as UTC representation
  // This makes the Date object represent local time without timezone conversion
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, ms));
}

/**
 * Convert any Date to UTC ISO-8601 format suitable for storage
 * Always use this for database storage, API responses, and calculations
 * @param date Date object to convert
 * @returns UTC timestamp like "2026-05-06T10:02:46.176Z"
 */
export function getUTCTimestamp(date: Date): string {
  return date.toISOString();
}

export function localToUTC(localDate: Date): Date {
  const offset = localDate.getTimezoneOffset() * 60 * 1000; // ms
  return new Date(localDate.getTime() + offset);
}

export function utcToLocal(utcDate: Date): Date {
  const offset = utcDate.getTimezoneOffset() * 60 * 1000; // ms
  return new Date(utcDate.getTime() - offset);
}

/**
 * TIME-KEEPER HELPERS
 * Simple helpers for employee clock-in/clock-out system
 *
 * IMPORTANT:
 * - Use getClockInTimeUTC() for the clock_in_time field (TIMESTAMP type, stores UTC)
 * - Use formatClockInForDisplay() to show time to employees (converts UTC → Manila time)
 * - created_at field is auto-generated by DB with CURRENT_TIMESTAMP (Manila time) - DO NOT include in your record
 */

/**
 * Get current time in UTC for storing in TIMESTAMP field
 * Use this when creating clock-in/out records
 * @returns ISO UTC string (e.g., "2026-05-07T02:57:13.938Z")
 * @example
 * const record = {
 *   employee_id: 123,
 *   clock_in_time: getClockInTimeUTC(),  // Stores as UTC
 *   status_id: 1
 *   // created_at is auto-generated by DB, don't include it
 * }
 */
export function getClockInTimeUTC(): string {
  return new Date().toISOString();
}

/**
 * Get timezone name from environment
 * Used internally by formatClockInForDisplay()
 * @returns Timezone string (e.g., "Asia/Manila")
 */
export function getTimeZoneName(): string {
  return process.env.APP_TIMEZONE || "Asia/Manila";
}

/**
 * Format UTC timestamp for display to employees (converts to Manila time)
 * Use when retrieving clock_in_time from database to show to user
 * @param utcTimestamp ISO UTC string from database (e.g., "2026-05-07T02:57:13.938Z")
 * @returns Formatted Manila time string (e.g., "5/7/2026, 10:57:13 AM")
 * @example
 * const displayTime = formatClockInForDisplay(record.clock_in_time);
 * // Result: "5/7/2026, 10:57:13 AM"
 */
export function formatClockInForDisplay(utcTimestamp: string): string {
  try {
    const date = new Date(utcTimestamp);
    return date.toLocaleString("en-US", {
      timeZone: getTimeZoneName(),
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    return "Invalid date";
  }
}

/**
 * Parse various date formats to the first day of the month (YYYY-MM-01)
 * Handles Excel serial dates, string dates, and Date objects
 * Respects Manila timezone for accurate month calculation
 * @param dateInput Excel serial number, date string, or Date object
 * @returns Date string in YYYY-MM-01 format, or null if invalid
 * @example
 * parseToFirstDayOfMonth(45078)  // Excel serial → "2026-05-01"
 * parseToFirstDayOfMonth("2026-05-15") // String → "2026-05-01"
 * parseToFirstDayOfMonth(new Date("2026-05-15")) // Date → "2026-05-01"
 */
export function parseToFirstDayOfMonth(dateInput: any): string | null {
  const dayjs = require("dayjs");
  const utc = require("dayjs/plugin/utc");
  const timezone = require("dayjs/plugin/timezone");

  dayjs.extend(utc);
  dayjs.extend(timezone);

  let parsedDate;

  // Handle Excel serial date (number)
  if (typeof dateInput === "number") {
    try {
      const XLSX = require("xlsx");
      const parsed = XLSX.SSF.parse_date_code(dateInput);
      if (parsed) {
        const year = parsed.y;
        const month = String(parsed.m).padStart(2, "0");
        return `${year}-${month}-01`;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Handle string date
  const timezoneName = getTimeZoneName();
  if (typeof dateInput === "string") {
    parsedDate = dayjs.tz(dateInput, timezoneName);
  } else if (dateInput instanceof Date) {
    // Handle Date object
    parsedDate = dayjs.tz(dateInput, timezoneName);
  } else {
    return null;
  }

  if (!parsedDate.isValid()) {
    return null;
  }

  // Get year and month in Manila timezone and format as YYYY-MM-01
  const year = parsedDate.year();
  const month = String(parsedDate.month() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

/**
 * Format a date string to "Month Year" format in Asia/Manila timezone
 * Respects Manila timezone for accurate month/year display
 * @param dateString Date string in YYYY-MM-DD format (e.g., "2026-05-01")
 * @returns Formatted string like "May 2026"
 * @example
 * formatDateToMonthYear("2026-05-01")  // "May 2026"
 * formatDateToMonthYear("2026-12-25")  // "December 2026"
 */
export function formatDateToMonthYear(dateString: string): string {
  try {
    const dayjs = require("dayjs");
    const utc = require("dayjs/plugin/utc");
    const timezone = require("dayjs/plugin/timezone");

    dayjs.extend(utc);
    dayjs.extend(timezone);

    const timezoneName = getTimeZoneName();
    const parsedDate = dayjs.tz(dateString, timezoneName);

    if (!parsedDate.isValid()) {
      return "Invalid date";
    }

    // Format as "Month Year" (e.g., "May 2026")
    return parsedDate.format("MMMM YYYY");
  } catch (error) {
    return "Invalid date";
  }
}
