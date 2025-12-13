import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

/**
 * SSE JWT Middleware
 *
 * Handles JWT token extraction from multiple sources:
 * 1. HTTP-Only Cookies (Secure, Recommended) - access_token
 * 2. Query Parameters (Fallback for testing/mobile) - ?token=...
 *
 * This allows flexibility while maintaining security:
 * - Production: Use HTTP-only cookies (set by auth service on login)
 * - Development/Testing: Can use query params
 * - Mobile/Third-party: Can use query params
 */
@Injectable()
export class SSEJwtMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Priority 1: HTTP-Only Cookie (Secure, Recommended for Production)
    const cookieAccessToken = req.cookies?.access_token;

    if (cookieAccessToken) {
      console.log("[SSE-JWT] Token found in HTTP-only cookie");
      req.headers.authorization = `Bearer_c+gi ${cookieAccessToken}`;
      return next();
    }

    // Priority 2: Query Parameter (Fallback for testing/mobile)
    if (req.query.xxx_auth && typeof req.query.xxx_auth === "string") {
      console.log("[SSE-JWT] Token found in query parameter (fallback)");
      req.headers.authorization = `Bearer_c+gi ${req.query.xxx_auth}`;
      return next();
    }

    // No token found - JwtAuthGuard will handle authentication error
    console.warn(
      "[SSE-JWT] No token found in cookies or query params. Request will fail auth guard."
    );
    next();
  }
}
