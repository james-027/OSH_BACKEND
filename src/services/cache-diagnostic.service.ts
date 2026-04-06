import { Injectable } from "@nestjs/common";
import logger from "src/config/logger";
import { getRedisClient } from "src/config/cache.config";

/**
 * Diagnostic Service for Cache Debugging
 * Tests Redis connection and cache functionality
 */
@Injectable()
export class CacheDiagnosticService {
  constructor() {}

  /**
   * Test basic cache operations
   */
  async testCacheOperation(key: string, value: any, ttl?: number): Promise<any> {
    try {
      logger.info(`[TEST REDIS] Starting test with key=${key}, ttl=${ttl}`);

      const client = getRedisClient();
      if (!client) {
        return {
          status: "error",
          message: "Redis client not initialized",
        };
      }

      // Write directly to Redis
      logger.info(`[TEST REDIS] Writing to Redis...`);
      const ttlSeconds = ttl || 300; // Default 5 minutes
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      logger.info(`✅ [TEST REDIS] SET successful: ${key}`);

      // Read back immediately
      logger.info(`[TEST REDIS] Reading from Redis...`);
      const redisValue = await client.get(key);

      if (redisValue) {
        logger.info(
          `✅ [TEST REDIS] GET successful: ${JSON.stringify(redisValue)}`,
        );
      } else {
        logger.warn(
          `⚠️ [TEST REDIS] Key NOT found in Redis after SET!`,
        );
      }

      // Check all keys in Redis
      try {
        const allKeys = await client.keys("*");

        logger.info(`[TEST REDIS] Redis verification:`);
        logger.info(`  - Direct GET result: ${redisValue ? "EXISTS" : "NULL"}`);
        logger.info(`  - Total keys in Redis: ${allKeys.length}`);
        logger.info(`  - Keys: ${allKeys.join(", ")}`);

        if (allKeys.length > 0) {
          return {
            status: "success",
            operation: "set+get",
            key,
            value: redisValue ? JSON.parse(redisValue) : null,
            total_keys: allKeys.length,
            all_keys: allKeys,
          };
        } else {
          logger.warn(`⚠️ No keys found in Redis!`);
          return {
            status: "error",
            redis_status: "FAILED - No keys in Redis",
            message: "Redis write/read test failed",
          };
        }
      } catch (redisErr) {
        const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
        logger.error(`❌ Redis verification failed: ${msg}`);
        return {
          status: "error",
          message: msg,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Cache operation test failed:`, errorMsg);
      return {
        status: "error",
        message: errorMsg,
      };
    }
  }

  /**
   * Get cache store info and Redis keys
   */
  async getCacheInfo(): Promise<any> {
    try {
      const client = getRedisClient();
      if (!client) {
        return {
          status: "error",
          message: "Redis client not initialized",
        };
      }

      const keys = await client.keys("*");
      const dbSize = await client.dbSize();

      return {
        store: "RedisOnly (Direct Redis Client)",
        redis_host: process.env.REDIS_HOST || "localhost",
        redis_port: process.env.REDIS_PORT || "6379",
        redis_password: process.env.REDIS_PASSWORD
          ? "***set***"
          : "using-default-walangpass",
        redis_db: process.env.REDIS_DB || "0",
        node_env: process.env.NODE_ENV || "development",
        connection_status: "✅ Connected",
        total_keys: dbSize,
        keys_sample: keys.slice(0, 10),
        all_keys: keys,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`❌ Error getting cache info:`, errorMessage);
      return {
        status: "error",
        message: errorMessage,
        hint: "Make sure Redis is running and accessible. Check REDIS_HOST, REDIS_PORT, REDIS_PASSWORD env vars.",
      };
    }
  }

  /**
   * Flush all cache for testing
   */
  async flushCache(): Promise<any> {
    try {
      const client = getRedisClient();
      if (!client) {
        return {
          status: "error",
          message: "Redis client not initialized",
        };
      }

      await client.flushDb();
      logger.info("✅ Cache flushed (FLUSHDB)");
      return { status: "success", message: "Cache flushed (FLUSHDB)" };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`❌ Flush cache error:`, errorMessage);
      return { status: "error", message: errorMessage };
    }
  }

  /**
   * Test direct Redis write (bypass cache-manager)
   * This helps identify if the problem is with cache-manager or Redis itself
   */
  async testRedisDirectly(key: string, value: string): Promise<any> {
    try {
      logger.info(`[REDIS DIRECT] Testing Redis directly...`);
      const client = getRedisClient();

      if (!client) {
        return {
          status: "error",
          message: "Redis client not initialized",
        };
      }

      // Write directly to Redis
      logger.info(`[REDIS DIRECT] Writing key="${key}", value="${value}"`);
      await client.set(key, JSON.stringify({ data: value, timestamp: new Date() }), {
        EX: 300, // 5 minute expiry
      });
      logger.info(`✅ [REDIS DIRECT] SET successful`);

      // Read back immediately
      const result = await client.get(key);
      logger.info(`[REDIS DIRECT] GET result: ${result}`);

      // Check if it exists
      const keys = await client.keys("*");
      logger.info(`[REDIS DIRECT] Total keys in Redis now: ${keys.length}`);
      logger.info(`[REDIS DIRECT] Keys: ${keys.join(", ")}`);

      return {
        status: "success",
        message: "Direct Redis write test successful",
        write_key: key,
        read_value: result,
        total_redis_keys: keys.length,
        redis_keys: keys,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`❌ [REDIS DIRECT] Test failed:`, errorMessage);
      return {
        status: "error",
        message: errorMessage,
        hint: "Direct Redis connection failed. Check server is running and credentials are correct.",
      };
    }
  }
}
