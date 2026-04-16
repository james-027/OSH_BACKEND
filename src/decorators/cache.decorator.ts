import { UseInterceptors, SetMetadata } from "@nestjs/common";
import {
  RedisOnlyInterceptor,
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from "../interceptors/redis-only.interceptor";
import { CACHE_TTL, CacheKeyBuilder } from "src/config/cache.config";

/**
 * Custom decorators for caching with predefined TTLs
 * Uses Redis-only storage (no in-memory bloat)
 *
 * Composite decorators apply caching setup: RedisOnlyInterceptor + CacheKey + TTL metadata
 */

/**
 * Set cache key metadata
 * Can be a static string or a function that generates the key based on request query/params
 */
export function CacheKey(key: string | CacheKeyBuilder) {
  return SetMetadata(CACHE_KEY_METADATA, key);
}

/**
 * Set cache TTL metadata (in seconds)
 */
export function CacheTTL(ttl: number) {
  return SetMetadata(CACHE_TTL_METADATA, ttl);
}

/**
 * Cache warehouse requirements queries with 5 min TTL
 * Usage: @CacheWarehouseRequirements('warehouse-reqs:all') or @CacheWarehouseRequirements(buildKeyFunction)
 */
export function CacheWarehouseRequirements(
  key: string | CacheKeyBuilder = "warehouse-reqs:default",
): MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(CACHE_TTL.WAREHOUSE_REQUIREMENTS)(target, propertyKey, descriptor); // 5 minutes
  };
}

/**
 * Cache transaction queries with 5 min TTL
 * Usage: @CacheTransactions('req-trans:headers:all') or @CacheTransactions(buildKeyFunction)
 */
export function CacheTransactions(
  key: string | CacheKeyBuilder = "req-trans:default",
): MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(CACHE_TTL.REQ_TRANSACTIONS)(target, propertyKey, descriptor); // 5 minutes
  };
}

/**
 * Cache requirement queries with 10 min TTL
 * Usage: @CacheRequirements('requirements:all') or @CacheRequirements(buildKeyFunction)
 */
export function CacheRequirements(
  key: string | CacheKeyBuilder = "requirements:default",
): MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(CACHE_TTL.REQUIREMENTS)(target, propertyKey, descriptor); // 10 minutes
  };
}

/**
 * Cache findAll queries with 5 min TTL
 * Usage: @CacheFindAll('staffs')
 */
export function CacheFindAll(serviceName: string): MethodDecorator {
  const key = `${serviceName}:find-all`;
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(CACHE_TTL.GENERAL_FIND_ALL)(target, propertyKey, descriptor); // 5 minutes
  };
}

/**
 * Cache findOne queries with 5 min TTL
 * Usage: @CacheFindOne('staffs')
 */
export function CacheFindOne(serviceName: string): MethodDecorator {
  const key = `${serviceName}:find-one`;
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(CACHE_TTL.GENERAL_FIND_ONE)(target, propertyKey, descriptor); // 5 minutes
  };
}

/**
 * Generic cache setup with custom TTL
 * Usage: @CacheCustom('my-key', 600) or @CacheCustom(buildKeyFunction, 600)
 */
export function CacheCustom(
  key: string | CacheKeyBuilder,
  ttl: number = 300,
): MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    UseInterceptors(RedisOnlyInterceptor)(target, propertyKey, descriptor);
    CacheKey(key)(target, propertyKey, descriptor);
    CacheTTL(ttl)(target, propertyKey, descriptor);
  };
}
