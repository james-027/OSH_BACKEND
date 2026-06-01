import { Injectable } from "@nestjs/common";
import { getRedisClient } from "../../../config/cache.config";
import { CACHE_KEYS, CACHE_PATTERNS } from "../../../config/cache.config";
import logger from "../../../config/logger";

/**
 * Cache Invalidation Service
 * Handles pattern-based cache clearing for SSE events and CRUD operations
 *
 * Pattern-based invalidation ensures that:
 * 1. Related caches are cleared together (DRY principle)
 * 2. SSE can trigger cache invalidation with a single pattern
 * 3. No stale data after create/update/delete operations
 */
@Injectable()
export class CacheInvalidationService {
  /**
   * Clear all warehouse requirement related caches
   * Called when: warehouse requirement is created/updated/deleted
   * SSE Event: warehouse-requirement:*
   */
  async invalidateWarehouseRequirements(): Promise<void> {
    const patterns = [
      CACHE_PATTERNS.WAREHOUSE_REQUIREMENTS,
      CACHE_PATTERNS.BASE_REQUIREMENTS,
      CACHE_PATTERNS.TRANSACTED_REQUIREMENTS,
    ];
    await this.invalidatePatterns(patterns);
  }

  /**
   * Clear all requirement transaction caches
   * Called when: transaction header/detail/due is created/updated/deleted
   * SSE Event: req-transaction:*
   */
  async invalidateReqTransactions(): Promise<void> {
    const patterns = [
      CACHE_PATTERNS.REQ_TRANSACTIONS,
      CACHE_PATTERNS.REQ_TRANSACTION_DETAILS,
    ];
    await this.invalidatePatterns(patterns);
  }

  /**
   * Clear all requirement caches
   * Called when: requirement is created/updated/deleted
   * SSE Event: requirement:*
   */
  async invalidateRequirements(): Promise<void> {
    const patterns = [
      CACHE_PATTERNS.REQUIREMENTS,
      // Also clear warehouse requirements because they depend on requirements
      CACHE_PATTERNS.WAREHOUSE_REQUIREMENTS,
      CACHE_PATTERNS.BASE_REQUIREMENTS,
      CACHE_PATTERNS.TRANSACTED_REQUIREMENTS,
    ];
    await this.invalidatePatterns(patterns);
  }

  /**
   * Clear warehouse caches
   * Called when: warehouse is created/updated/deleted
   * SSE Event: warehouse:*
   */
  async invalidateWarehouses(): Promise<void> {
    const patterns = [
      CACHE_PATTERNS.WAREHOUSE_REQUIREMENTS,
      CACHE_PATTERNS.BASE_REQUIREMENTS,
      CACHE_PATTERNS.TRANSACTED_REQUIREMENTS,
      CACHE_PATTERNS.WAREHOUSE,
    ];
    await this.invalidatePatterns(patterns);
  }

  /**
   * Clear warehouse employees caches
   * Called when: warehouse employee is created/updated/deleted
   * SSE Event: warehouse-employees:*
   */
  async invalidateWarehouseEmployees(): Promise<void> {
    const patterns = [CACHE_PATTERNS.WAREHOUSE_EMPLOYEES];
    await this.invalidatePatterns(patterns);
  }

  /**
   * Clear warehouse hurdles caches
   * Called when: warehouse hurdle is created/updated/deleted
   * SSE Event: warehouse-hurdles:*
   */
  async invalidateWarehouseHurdles(): Promise<void> {
    const patterns = [CACHE_PATTERNS.WAREHOUSE_HURDLES];
    await this.invalidatePatterns(patterns);
  }

  async invalidateApprovalStagesList(): Promise<void> {
  const patterns = [
    CACHE_PATTERNS.APPROVAL_STAGES_LIST,
  ];

  await this.invalidatePatterns(
    patterns,
  );
}

  /**
   * Clear a specific service's findAll cache
   * @param serviceName - name of the service (e.g., 'staffs', 'vendors')
   */
  async invalidateFindAll(serviceName: string): Promise<void> {
    const key = CACHE_KEYS.FIND_ALL(serviceName);
    await this.invalidateKey(key);
  }

  /**
   * Clear a specific service's findOne cache
   * @param serviceName - name of the service
   */
  async invalidateFindOne(serviceName: string): Promise<void> {
    const key = CACHE_KEYS.FIND_ONE(serviceName);
    await this.invalidateKey(key);
  }

  /**
   * Clear both findAll and findOne for a service
   * @param serviceName - name of the service
   */
  async invalidateServiceCache(serviceName: string): Promise<void> {
    await Promise.all([
      this.invalidateKey(CACHE_KEYS.FIND_ALL(serviceName)),
      this.invalidateKey(CACHE_KEYS.FIND_ONE(serviceName)),
    ]);
  }

  /**
   * Clear cache by exact key
   * @param key - cache key to delete
   */
  async invalidateKey(key: string): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) {
        logger.warn(
          `[CacheInvalidation] Redis client not available for key deletion: ${key}`,
        );
        return;
      }
      await client.del(key);
      logger.debug(`[CacheInvalidation] Deleted key: ${key}`);
    } catch (error) {
      logger.error(`[CacheInvalidation] Error deleting key ${key}:`, error);
    }
  }

  /**
   * Clear multiple cache keys by pattern
   * Pattern should be in format: "prefix:*"
   * For Redis: Uses SCAN (non-blocking) instead of KEYS (blocking)
   * SCAN iterates over keys in chunks, preventing Redis from freezing
   * @param patterns - array of cache key patterns
   */
  private async invalidatePatterns(patterns: string[]): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) {
        logger.warn(
          `[CacheInvalidation] Redis client not available for pattern invalidation`,
        );
        return;
      }

      for (const pattern of patterns) {
        try {
          // Use SCAN instead of KEYS to avoid blocking Redis
          // SCAN is non-blocking and returns results in chunks (cursor-based iteration)
          let cursor = "0";
          let totalCleared = 0;

          do {
            const reply = await client.scan(parseInt(cursor), {
              MATCH: pattern,
              COUNT: 100, // Process 100 keys per iteration
            });
            cursor = String(reply.cursor);
            const keys = reply.keys;

            if (keys.length > 0) {
              await client.del(keys);
              totalCleared += keys.length;
            }
          } while (cursor !== "0"); // Continue until cursor returns to 0

          if (totalCleared > 0) {
            logger.debug(
              `[CacheInvalidation] Cleared ${totalCleared} keys matching pattern: ${pattern}`,
            );
          }
        } catch (error) {
          logger.error(
            `[CacheInvalidation] Error invalidating cache pattern ${pattern}:`,
            error,
          );
          // Continue invalidating other patterns even if one fails
        }
      }
    } catch (error) {
      logger.error(`[CacheInvalidation] Error accessing Redis client:`, error);
    }
  }

  /**
   * Clear ALL caches (use with caution)
   * Called during emergency data refresh or maintenance
   */
  async invalidateAll(): Promise<void> {
    try {
      const client = getRedisClient();
      if (!client) {
        logger.warn(
          `[CacheInvalidation] Redis client not available for full flush`,
        );
        return;
      }

      await client.flushDb();
      logger.info(`[CacheInvalidation] ✅ All caches cleared (FLUSHDB)`);
    } catch (error) {
      logger.error(`[CacheInvalidation] Error clearing all caches:`, error);
    }
  }
}
