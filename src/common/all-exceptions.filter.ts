import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import logger from "../config/logger";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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
    if (typeof response.code === "function" && typeof response.send === "function") {
      // Fastify
      response.code(status).send(errorResponse);
    } else if (typeof response.status === "function" && typeof response.json === "function") {
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
