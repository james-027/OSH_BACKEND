import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import logger from "src/config/logger";

/**
 * PhpShieldGuard
 *
 * Runs after body parser in both Express and Fastify to inspect
 * parsed body payloads, query parameters, headers, and URLs.
 */
@Injectable()
export class PhpShieldGuard implements CanActivate {
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

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
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

        throw new BadRequestException({
          status: "error",
          msg: "Request rejected due to anomalous payload or security pattern violation.",
        });
      }
    }

    return true;
  }
}
