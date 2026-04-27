import { Injectable, NestMiddleware, Inject } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ThrottleTrackingService } from "../guards/throttle-tracking.guard";

/**
 * Middleware to track throttle attempt counts per IP
 * Increments counter on each request and stores it IMMEDIATELY for access in exception filter
 */
@Injectable()
export class ThrottleTrackingMiddleware implements NestMiddleware {
  constructor(
    @Inject(ThrottleTrackingService)
    private throttleTrackingService: ThrottleTrackingService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      req.ip ||
      "UNKNOWN";

    // Default TTL: 60 seconds (60000ms)
    const ttl = 60000;

    // Increment the attempt count for this IP
    const attempts = this.throttleTrackingService.incrementAttempt(ip, ttl);

    // Store the attempt count IMMEDIATELY for access in exception filter
    // This runs before the guard, so the count is always available
    this.throttleTrackingService.recordAttemptInfo(ip, attempts, 0);

    console.log(
      `🔥 [THROTTLE-TRACKING-MIDDLEWARE] IP: ${ip} | Attempt #${attempts}`,
    );

    next();
  }
}
