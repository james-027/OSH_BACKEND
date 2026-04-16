import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CacheDiagnosticService } from "../services/cache-diagnostic.service";
import { JwtAuthGuard } from "src/guards/jwt-auth.guard";
import logger from "src/config/logger";

/**
 * Debug Controller for Cache Testing
 * Endpoints to diagnose cache and Redis issues
 *
 * Routes:
 * GET /debug/cache/info - Get cache configuration info
 * GET /debug/cache/test - Test cache SET/GET operations
 * POST /debug/cache/flush - Clear all cache
 */
@UseGuards(JwtAuthGuard)
@Controller("debug/cache")
export class CacheDebugController {
  constructor(
    private readonly cacheDiagnosticService: CacheDiagnosticService,
  ) {}

  /**
   * Get cache store configuration
   * GET /debug/cache/info
   */
  @Get("info")
  async getCacheInfo() {
    return await this.cacheDiagnosticService.getCacheInfo();
  }

  /**
   * Test cache operations
   * GET /debug/cache/test?key=test-key&value=test-value&ttl=300
   */
  @Get("test")
  async testCache(
    @Query("key") key: string = "test:debug:key",
    @Query("value") value: string = "test-value",
    @Query("ttl") ttl?: string,
  ) {
    logger.debug(
      `[CACHE DEBUG] Testing cache with key=${key}, value=${value}, ttl=${ttl}`,
    );
    return await this.cacheDiagnosticService.testCacheOperation(
      key,
      { message: value, timestamp: new Date().toISOString() },
      ttl ? parseInt(ttl, 10) * 1 : undefined,
    );
  }

  /**
   * Direct Redis write test (bypass cache-manager)
   * GET /debug/cache/redis-direct?key=test-redis:key&value=test-value
   */
  @Get("redis-direct")
  async testRedisDirectly(
    @Query("key") key: string = "test:redis:direct",
    @Query("value") value: string = "direct-test",
  ) {
    logger.info(`[REDIS DIRECT TEST] Writing directly to Redis...`);
    return await this.cacheDiagnosticService.testRedisDirectly(key, value);
  }

  /**
   * Flush cache
   * POST /debug/cache/flush
   */
  @Post("flush")
  async flushCache() {
    return await this.cacheDiagnosticService.flushCache();
  }
}
