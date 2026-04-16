import { Transform } from "class-transformer";

/**
 * Sanitizes HTML/XSS from string input
 * Removes potentially dangerous scripts and tags
 * Returns plain text only
 */
export function sanitizeInput(input: any): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  // Remove script tags and their content
  let sanitized = input.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );

  // Remove event handlers (onclick, onload, etc)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove other potentially dangerous tags
  sanitized = sanitized.replace(
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    "",
  );
  sanitized = sanitized.replace(/<link\b[^>]*>/gi, "");
  sanitized = sanitized.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    "",
  );

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Decorator to sanitize string inputs
 * Apply to any string field in DTO to auto-sanitize on transformation
 *
 * Usage:
 * @SanitizeString()
 * @IsString()
 * location_name!: string;
 */
export function SanitizeString() {
  return Transform(({ value }) => sanitizeInput(value), { toClassOnly: true });
}
