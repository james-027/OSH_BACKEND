import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import logger from "../config/logger";
import { ThrottleTrackerService } from "../services/throttle-tracker.service";
import { ThrottleTrackingService } from "../guards/throttle-tracking.guard";
import * as fs from "fs";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(ThrottleTrackerService)
    private throttleTracker: ThrottleTrackerService,
    @Inject(ThrottleTrackingService)
    private throttleTrackingService: ThrottleTrackingService,
    private reflector: Reflector,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message =
        typeof errorResponse === "string"
          ? errorResponse
          : (errorResponse as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;

      // Map specific error types to HTTP status codes
      if (message.includes("not found") || message.includes("Not found")) {
        status = HttpStatus.NOT_FOUND;
      } else if (
        message.includes("already exists") ||
        message.includes("duplicate")
      ) {
        status = HttpStatus.CONFLICT;
      } else if (message.includes("Invalid") || message.includes("required")) {
        status = HttpStatus.BAD_REQUEST;
      } else if (
        message.includes("Unauthorized") ||
        message.includes("Invalid credentials")
      ) {
        status = HttpStatus.UNAUTHORIZED;
      }
    }

    // RATE LIMIT LOGGING: If this is a 429 (Too Many Requests), log to rate-limit.log
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      logger.info(
        "🔥🔥🔥 [ALL-EXCEPTIONS-FILTER] ============= CAUGHT 429 - LOGGING TO RATE-LIMIT.LOG =============",
      );

      const ip =
        request.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
        request.ip ||
        "UNKNOWN";

      // For Fastify, use request.url instead of request.path
      const url =
        request.url || request.originalUrl || request.path || "UNKNOWN";
      const endpoint = `${request.method} ${url}`;
      const userAgent = request.headers["user-agent"]?.toString() || "UNKNOWN";

      // Format timestamp as YYYY-MM-DD HH:MM:SS (local time, not UTC)
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // Get attempt count from throttle tracker service
      let attemptInfo = "?";
      try {
        // Try to get stored throttle info from the service
        const info = this.throttleTrackingService.getAttemptInfo(ip);
        if (info) {
          // If limit is 0, just show attempt count
          if (info.limit === 0 || info.limit === undefined) {
            attemptInfo = `${info.attempts}`;
          } else {
            // Otherwise show both attempt and limit
            attemptInfo = `${info.attempts}/${info.limit}`;
          }
        } else {
          // Fallback: try to get limit from the old tracker
          const throttleData = this.throttleTracker.getThrottleData(ip);
          if (throttleData) {
            attemptInfo = `${throttleData.attempts}/${throttleData.limit}`;
          }
        }
      } catch (error) {
        // Silent fail - use default "?"
      }

      // Ensure logs directory exists
      if (!fs.existsSync("logs")) {
        fs.mkdirSync("logs", { recursive: true });
      }

      // Write to rate-limit.log SYNCHRONOUSLY
      const logEntry = `[${timestamp}] IP: ${ip} | Endpoint: ${endpoint} | Attempts: ${attemptInfo} | UserAgent: ${userAgent} | Message: Rate limit exceeded\n`;

      try {
        fs.appendFileSync("logs/rate-limit.log", logEntry, "utf8");
        logger.info(
          "✅ [ALL-EXCEPTIONS-FILTER] Successfully written to logs/rate-limit.log",
        );
      } catch (error) {
        logger.error("❌ [ALL-EXCEPTIONS-FILTER] Failed to write log:", error);
      }
    }

    // Log the error
    const url = request.url || request.raw?.url || "unknown";
    const method = request.method || request.raw?.method || "unknown";

    logger.error(`${method} ${url} - ${status} - ${message}`, {
      exception: exception instanceof Error ? exception.stack : exception,
      timestamp: new Date().toISOString(),
      url,
      method,
    });

    // Platform-agnostic response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: url,
      error: message,
    };

    // Check platform: Fastify has .code() and .send(), Express has .status() and .json()
    if (
      typeof response.code === "function" &&
      typeof response.send === "function"
    ) {
      // Fastify
      response.code(status).send(errorResponse);
    } else if (
      typeof response.status === "function" &&
      typeof response.json === "function"
    ) {
      // Express
      response.status(status).json(errorResponse);
    } else {
      // Fallback - try Fastify style first, then Express
      try {
        response.code(status).send(errorResponse);
      } catch (e) {
        response.status(status).json(errorResponse);
      }
    }
  }
}
