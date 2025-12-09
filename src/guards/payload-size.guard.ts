import {
  Injectable,
  CanActivate,
  ExecutionContext,
  PayloadTooLargeException,
} from "@nestjs/common";

/**
 * Guard to enforce endpoint-specific payload size limits
 * Works with both Express and Fastify
 */
@Injectable()
export class PayloadSizeGuard implements CanActivate {
  // Payload size limits per endpoint/route
  private readonly PAYLOAD_LIMITS = {
    // Batch operations: 750MB
    "/req-transaction-headers/batch-create": 750 * 1024 * 1024,
    "/req-transaction-details/batch-create": 750 * 1024 * 1024,
    "/req-transaction-dues/batch-create": 750 * 1024 * 1024,

    // Standard operations: 10MB (enforced by Guard, HTTP layer set to 800MB to allow Guard to reject)
    default: 10 * 1024 * 1024,
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const contentLength = request.headers["content-length"];

    if (!contentLength) {
      return true; // No content length provided, allow
    }

    const payloadSize = parseInt(contentLength, 10);
    const url = request.url || request.path || "";

    // Find the limit for this endpoint
    let limit = this.PAYLOAD_LIMITS.default;
    for (const [route, routeLimit] of Object.entries(this.PAYLOAD_LIMITS)) {
      if (route !== "default" && url.includes(route)) {
        limit = routeLimit;
        break;
      }
    }

    if (payloadSize > limit) {
      const limitMB = (limit / 1024 / 1024).toFixed(0);
      const sizeMB = (payloadSize / 1024 / 1024).toFixed(2);

      throw new PayloadTooLargeException(
        `Payload too large. Max ${limitMB}MB allowed for this endpoint. Received: ${sizeMB}MB`
      );
    }

    return true;
  }
}
