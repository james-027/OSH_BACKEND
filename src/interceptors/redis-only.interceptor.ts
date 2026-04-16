import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import logger from "src/config/logger";
import { getRedisClient, CacheKeyBuilder } from "src/config/cache.config";

// Metadata keys for caching
export const CACHE_KEY_METADATA = "cache_key";
export const CACHE_TTL_METADATA = "cache_ttl";

// Cache size and TTL limits - prevents Redis abuse and bloat
const MAX_CACHE_SIZE = 8 * 1024 * 1024; // 8MB max per entry
const MIN_TTL = 60; // Minimum 1 minute
const MAX_TTL = 86400; // Maximum 24 hours

/**
 * Redis-Only Cache Interceptor
 *
 * Caches responses ONLY in Redis, not in memory.
 * - Checks Redis for cached data on request
 * - If found, returns cached value immediately
 * - If not found, executes controller and caches response in Redis
 * - Validates response size (max 5MB) and TTL (60s-24h) to prevent abuse
 *
 * Usage with decorators:
 * @UseInterceptors(RedisOnlyInterceptor)
 * @CacheKey('my-cache-key')
 * @CacheTTL(300)  // seconds (will be clamped to 60-86400)
 * async myMethod() { ... }
 */
@Injectable()
export class RedisOnlyInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Get cache key (can be string or function) and TTL from metadata
    const cacheKeyOrBuilder = this.reflector.get<string | CacheKeyBuilder>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    let cacheTtl = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );

    // If no cache key, skip caching
    if (!cacheKeyOrBuilder) {
      return next.handle();
    }

    // Get request object to build dynamic cache key if needed
    const request = context.switchToHttp().getRequest();

    // Build cache key: if it's a function, call it with query, params, and user; otherwise use as-is
    let cacheKey: string;
    if (typeof cacheKeyOrBuilder === "function") {
      cacheKey = cacheKeyOrBuilder(request.query, request.params, request.user);
      logger.debug(
        `[RedisCache] Dynamic key built: ${cacheKey} (from query/params/user)`,
      );
    } else {
      cacheKey = cacheKeyOrBuilder;
    }

    // Validate and normalize TTL to safe bounds
    let normalizedTtl = cacheTtl || 300; // Default 5 minutes
    if (normalizedTtl < MIN_TTL) {
      logger.warn(
        `[RedisCache] TTL too low (${normalizedTtl}s), using minimum (${MIN_TTL}s) for key: ${cacheKey}`,
      );
      normalizedTtl = MIN_TTL;
    } else if (normalizedTtl > MAX_TTL) {
      logger.warn(
        `[RedisCache] TTL too high (${normalizedTtl}s), using maximum (${MAX_TTL}s) for key: ${cacheKey}`,
      );
      normalizedTtl = MAX_TTL;
    }

    try {
      const client = getRedisClient();

      // If Redis is not initialized, skip caching
      if (!client) {
        logger.warn(
          `[RedisCache] Redis client not available, skipping cache for: ${cacheKey}`,
        );
        return next.handle();
      }

      // Try to get from Redis
      logger.debug(`[RedisCache] Checking cache for key: ${cacheKey}`);
      const cachedData = await client.get(cacheKey);

      if (cachedData) {
        logger.debug(`[RedisCache] HIT: ${cacheKey}`);
        try {
          const parsed = JSON.parse(cachedData);
          // Return cached value immediately (don't call next.handle())
          return of(parsed);
        } catch (parseErr) {
          logger.warn(
            `[RedisCache] Failed to parse cached data for ${cacheKey}:`,
            parseErr,
          );
          // If parse fails, execute controller
        }
      }

      logger.debug(`[RedisCache] MISS: ${cacheKey}`);

      // Cache miss - execute controller and cache result
      return next.handle().pipe(
        tap(async (response) => {
          try {
            const serialized = JSON.stringify(response);
            const sizeInMB = serialized.length / 1024 / 1024;

            // Validate response size before caching
            if (serialized.length > MAX_CACHE_SIZE) {
              logger.warn(
                `[RedisCache] Response too large (${sizeInMB.toFixed(2)}MB) for key: ${cacheKey}, skipping cache to preserve Redis memory`,
              );
              return; // Skip caching, but still return response to client
            }

            if (normalizedTtl > 0) {
              // setEx: key, ttlInSeconds, value
              await client.setEx(cacheKey, normalizedTtl, serialized);
              logger.info(
                `[RedisCache] SET: ${cacheKey} (TTL: ${normalizedTtl}s, Size: ${(serialized.length / 1024).toFixed(2)}KB)`,
              );
            } else {
              await client.set(cacheKey, serialized);
              logger.info(
                `[RedisCache] SET: ${cacheKey} (no TTL, Size: ${(serialized.length / 1024).toFixed(2)}KB)`,
              );
            }
          } catch (err) {
            logger.error(`[RedisCache] Failed to cache response:`, err);
            // Don't throw - let response go through even if caching fails
          }
        }),
      );
    } catch (err) {
      logger.error(`[RedisCache] Interceptor error:`, err);
      // If Redis fails, just execute without caching
      return next.handle();
    }
  }
}
