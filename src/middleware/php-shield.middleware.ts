import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from "@nestjs/common";
import logger from "src/config/logger";

/**
 * PhpShieldMiddleware
 *
 * Inspects incoming requests across URLs, headers, query parameters,
 * and body payloads to detect and reject PHP vulnerability exploits,
 * such as PHP_SESSION_UPLOAD_PROGRESS, PHP wrappers (php://, data://),
 * directory traversal (LFI), null byte injection, and dangerous directives.
 */
@Injectable()
export class PhpShieldMiddleware implements NestMiddleware {
  private readonly dangerousPatterns: { name: string; regex: RegExp }[] = [
    {
      name: "PHP_SESSION_UPLOAD_PROGRESS",
      regex: /PHP_SESSION_UPLOAD_PROGRESS/i,
    },
    {
      name: "session.upload_progress",
      regex: /session\.upload_progress/i,
    },
    {
      name: "PHP stream wrapper",
      regex: /(?:php|data|phar|expect|zip|glob):\/\//i,
    },
    {
      name: "Dangerous PHP configuration directive",
      regex: /(?:auto_prepend_file|auto_append_file|allow_url_include)/i,
    },
    {
      name: "Directory traversal / LFI",
      regex: /(?:\.\.[\/\\]|%2e%2e[\/\\]|%2e%2e%2f|%2e%2e%5c)/i,
    },
    {
      name: "Null byte injection",
      regex: /(?:%00|\\0|\\x00)/i,
    },
  ];

  use(req: any, res: any, next: () => void): void {
    const url = req.originalUrl || req.url || "";
    const headersStr = req.headers ? JSON.stringify(req.headers) : "";
    const queryStr = req.query ? JSON.stringify(req.query) : "";
    let bodyStr = "";

    if (req.body) {
      bodyStr =
        typeof req.body === "object"
          ? JSON.stringify(req.body)
          : String(req.body);
    }

    const inspectTarget = `${url} ${headersStr} ${queryStr} ${bodyStr}`;

    for (const pattern of this.dangerousPatterns) {
      if (pattern.regex.test(inspectTarget)) {
        const clientIp =
          req.headers?.["x-forwarded-for"]?.toString().split(",")[0].trim() ||
          req.ip ||
          req.socket?.remoteAddress ||
          "UNKNOWN";

        logger.warn(
          `🛡️ [PHP-SHIELD-BLOCKED] Rejected suspicious request from ${clientIp} to ${url} - Matched pattern: ${pattern.name}`,
        );

        throw new BadRequestException(
          "Request rejected due to anomalous payload or security pattern violation.",
        );
      }
    }

    next();
  }
}
