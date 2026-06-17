/**
 * Excel Validation and Formatting Utility
 * Provides reusable validation and formatting for Excel row data with dynamic field configuration
 */

export interface FieldFormatConfig {
  format?:
    | "uppercase"
    | "lowercase"
    | "uppercase-trim"
    | "lowercase-trim"
    | "trim"
    | "none"
    | "number-trim"; // NEW: Accepts 0, rejects blank/null/non-numeric
  nullable?: boolean;
}

export interface ExcelValidationConfig {
  // Required fields with their format configurations. Format is explicit - if not provided, defaults to "none"
  requiredFields: { [fieldName: string]: FieldFormatConfig };
  // Optional fields with their format configurations and nullable flag
  optionalFields?: { [fieldName: string]: FieldFormatConfig };
}

/**
 * Trims whitespace from a string value.
 * FIXED: Properly handles numeric 0 (previously 0 || "" returned "" because 0 is falsy)
 */
function trimValue(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Apply formatting rules to a field value
 * NEW: "number-trim" format — accepts 0, rejects blank/null/non-numeric strings
 */
function formatValue(value: any, format?: string): any {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = trimValue(value);

  // If trimmed is empty, return null
  if (trimmed === "") {
    return null;
  }

  switch (format) {
    case "uppercase":
      return trimmed.toUpperCase();
    case "lowercase":
      return trimmed.toLowerCase();
    case "uppercase-trim":
      return trimmed.toUpperCase();
    case "lowercase-trim":
      return trimmed.toLowerCase();
    case "trim":
      return trimmed;
    case "number-trim":
      // Convert trimmed string to number — accepts 0, rejects NaN
      const num = Number(trimmed);
      if (isNaN(num)) return null; // "abc", "12px", etc. → null → rejected
      return num; // 0, "10", "-5.5" → 0, 10, -5.5
    case "none":
    default:
      return value;
  }
}

/**
 * Validates and formats an Excel row based on provided configuration
 * @param row - Raw Excel row data
 * @param config - Validation and formatting configuration
 * @returns Formatted and validated row data
 * @throws Error if required fields are missing or validation fails
 */
export function validateAndFormatExcelRow(
  row: Record<string, any>,
  config: ExcelValidationConfig,
): Record<string, any> {
  const formatted: Record<string, any> = { ...row };

  // 1. Validate and format required fields
  for (const [fieldName, fieldConfig] of Object.entries(
    config.requiredFields,
  )) {
    const value = row[fieldName];

    // Check if field exists and is not empty
    // FIXED: trimValue now correctly handles numeric 0 ("0" !== "")
    if (value === null || value === undefined || trimValue(value) === "") {
      throw new Error(`Missing required field: ${fieldName}`);
    }

    // Apply formatting based on explicit format configuration
    const format = fieldConfig.format || "none";
    const formatted_value = formatValue(value, format);

    // For required fields, if value becomes null after formatting, it's an error
    // This catches "number-trim" fields with non-numeric strings like "abc"
    if (formatted_value === null && !fieldConfig.nullable) {
      throw new Error(
        `Field ${fieldName} cannot be empty after formatting (not nullable)`,
      );
    }

    formatted[fieldName] = formatted_value;
  }

  // 2. Handle optional fields with special null handling
  if (config.optionalFields) {
    for (const [fieldName, fieldConfig] of Object.entries(
      config.optionalFields,
    )) {
      if (row[fieldName] !== undefined) {
        const value = row[fieldName];
        const format = fieldConfig.format || "none";

        // If field is nullable and value is empty/null/undefined, set to null
        if (fieldConfig.nullable) {
          if (
            value === null ||
            value === undefined ||
            trimValue(value) === ""
          ) {
            formatted[fieldName] = null;
          } else {
            // Otherwise apply formatting
            formatted[fieldName] = formatValue(value, format);
          }
        } else {
          // Field is not nullable, so must have a value
          if (
            value === null ||
            value === undefined ||
            trimValue(value) === ""
          ) {
            formatted[fieldName] = null; // Or could throw error depending on requirement
          } else {
            formatted[fieldName] = formatValue(value, format);
          }
        }
      }
    }
  }

  return formatted;
}
