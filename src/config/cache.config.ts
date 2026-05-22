/**
 * Redis-Only Cache Configuration
 *
 * Uses Redis ONLY for caching - no in-memory storage.
 * The RedisOnlyInterceptor in src/interceptors/redis-only.interceptor.ts
 * handles all cache operations directly with Redis.
 */

import { createClient, RedisClientType } from "redis";
import logger from "./logger";

let redisClient: RedisClientType | null = null;

/**
 * Initialize and export Redis client for use throughout the app
 */
export async function initializeRedisClient(): Promise<RedisClientType> {
  if (redisClient) return redisClient;

  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
  const redisPassword = process.env.REDIS_PASSWORD || "walangpass";
  const redisDb = parseInt(process.env.REDIS_DB || "0", 10);

  logger.info(
    `[CACHE CONFIG] Connecting to Redis at ${redisHost}:${redisPort} (DB ${redisDb})`,
  );

  try {
    redisClient = createClient({
      socket: { host: redisHost, port: redisPort },
      password: redisPassword,
    }) as RedisClientType;

    redisClient.on("error", (err) => logger.error("[Redis] Error:", err));
    redisClient.on("connect", () => logger.info("[Redis] Connected"));

    await redisClient.connect();

    if (redisDb > 0) {
      await redisClient.select(redisDb);
      logger.info(`[CACHE CONFIG] Selected Redis DB: ${redisDb}`);
    }

    logger.info(`[CACHE CONFIG] ✅ Redis client ready`);
    return redisClient;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[CACHE CONFIG] ❌ Failed to initialize Redis: ${msg}`);
    throw error;
  }
}

/**
 * Get Redis client (must call initializeRedisClient first)
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Cache TTL mapping by controller/service
 * Used for configurable cache timeouts
 */
export const CACHE_KEYS = {
  // Warehouse Requirements Service (heavy)
  WAREHOUSE_REQUIREMENTS_LISTING: "warehouse-reqs:listing",
  WAREHOUSE_REQUIREMENTS_LISTING_OPTIMIZED: "warehouse-reqs:listing-optimized",
  WAREHOUSE_REQUIREMENTS_COUNTS: "warehouse-reqs:counts",
  BASE_REQUIREMENTS_DETAILS: "base-reqs:details",
  TRANSACTED_REQUIREMENTS_DETAILS: "trans-reqs:details",

  // Req Transaction Headers (heavy)
  REQ_TRANSACTION_HEADERS_ALL: "req-trans:headers:all",
  REQ_TRANSACTION_HEADERS_GROUP_BY_TRANS:
    "req-trans:headers:group-by-trans-number",
  REQ_TRANSACTION_HEADERS_FIND_BY_TRANS:
    "req-trans:headers:find-by-trans-number",
  REQ_TRANSACTION_HEADERS_BY_ID: "req-trans:headers:by-id",

  // Requirements
  REQUIREMENTS_ALL: "requirements:all",
  REQUIREMENTS_ONE: "requirements:one",

  // General findAll/findOne (by service name)
  FIND_ALL: (service: string) => `${service}:find-all`,
  FIND_ONE: (service: string) => `${service}:find-one`,
  PATTERN: (prefix: string) => `${prefix}:*`, // For cache invalidation patterns
};

/**
 * Cache invalidation patterns by feature
 * Used for pattern-based cache clearing (works with Redis SCAN, etc.)
 * Maps feature names to their cache key prefixes with wildcard
 * DRY principle: All patterns defined once, used everywhere for invalidation
 */
export const CACHE_PATTERNS = {
  // Warehouse requirements and related
  WAREHOUSE_REQUIREMENTS: "warehouse-reqs:*",
  BASE_REQUIREMENTS: "base-reqs:*",
  TRANSACTED_REQUIREMENTS: "trans-reqs:*",

  // Transaction headers
  REQ_TRANSACTIONS: "req-trans:*",
  REQ_TRANSACTION_DETAILS: "req-transaction:*",

  // Requirements
  REQUIREMENTS: "requirements:*",

  // Warehouse
  WAREHOUSE: "warehouse:*",

  // Warehouse Hurdles
  WAREHOUSE_HURDLES: "warehouse-hurdles:*",

  // Warehouse Employees
  WAREHOUSE_EMPLOYEES: "warehouse-employees:*",
};

export const CACHE_TTL = {
  // Heavy queries (DB intensive, data doesn't change frequently)
  // 8 hours in production, 5 minutes in development
  WAREHOUSE_REQUIREMENTS: process.env.NODE_ENV === "production" ? 28800 : 600,
  REQ_TRANSACTIONS: process.env.NODE_ENV === "production" ? 28800 : 600,

  // Medium frequency
  REQUIREMENTS: process.env.NODE_ENV === "production" ? 28800 : 600,
  GENERAL_FIND_ALL: process.env.NODE_ENV === "production" ? 28800 : 600,
  GENERAL_FIND_ONE: process.env.NODE_ENV === "production" ? 28800 : 600,

  // Fast changing data
  TRANSACTION_DETAILS: process.env.NODE_ENV === "production" ? 28800 : 600,

  // Dashboard/Counts
  COUNTS: process.env.NODE_ENV === "production" ? 28800 : 600,
};

/**
 * ==================== Dynamic Cache Key Builders ====================
 *
 * These functions generate cache keys based on query parameters.
 * Used in decorators for endpoints with @Query() parameters.
 * Concatenates base key + all query params for unique cache entries per param combination.
 *
 * Shared cache logic: userId/roleId/access_key NOT included in key:
 * - Different users requesting same params get same cached data (maximizes cache hits)
 * - All users benefit from data cached by first requester with those params
 */

/**
 * Cache key builder for req-transaction-headers findAllByTransNumber
 * Includes: userId, roleId, accessKeyId, date_from, date_to, trans_number
 */
export function buildReqTransHeaderGroupKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.REQ_TRANSACTION_HEADERS_GROUP_BY_TRANS;
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const dateFrom = query.date_from
    ? String(query.date_from).toLowerCase()
    : "all";
  const dateTo = query.date_to ? String(query.date_to).toLowerCase() : "all";
  const transNumber = query.trans_number
    ? String(query.trans_number).toLowerCase()
    : "all";
  const requirementTypeId = query.requirement_type_id
    ? String(query.requirement_type_id).toLowerCase()
    : "all";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${dateFrom}:${dateTo}:${transNumber}:${requirementTypeId}`;
}

/**
 * Cache key builder for req-transaction-headers findOneByTransNumber
 * Includes: userId, roleId, accessKeyId, trans_number
 */
export function buildReqTransHeaderFindByTransKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.REQ_TRANSACTION_HEADERS_FIND_BY_TRANS;
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const transNumber = query.trans_number
    ? String(query.trans_number).toLowerCase()
    : "all";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${transNumber}`;
}

/**
 * Cache key builder for warehouse-requirements getWarehouseRequirementsListing
 * Includes: userId, roleId, accessKeyId, warehouse_id, date_from, date_to, flatten
 */
export function buildWarehouseRequirementsListingKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.WAREHOUSE_REQUIREMENTS_LISTING_OPTIMIZED;
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const warehouseTypeId = params.warehouse_type_id || "all";
  const warehouseId = query.warehouse_id
    ? String(query.warehouse_id).toLowerCase()
    : "all";
  const dateFrom = query.date_from
    ? String(query.date_from).toLowerCase()
    : "all";
  const dateTo = query.date_to ? String(query.date_to).toLowerCase() : "all";
  const flatten = query.flatten ? String(query.flatten).toLowerCase() : "false";
  const requirementTypeId = query.requirement_type_id
    ? String(query.requirement_type_id).toLowerCase()
    : "false";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${warehouseTypeId}:${warehouseId}:${dateFrom}:${dateTo}:${flatten}:${requirementTypeId}`;
}

/**
 * Cache key builder for warehouse-requirements getWarehouseRequirementsListingCounts
 * Includes: userId, roleId, accessKeyId, warehouse_id, date_from, date_to
 */
export function buildWarehouseRequirementsCountsKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.WAREHOUSE_REQUIREMENTS_COUNTS;
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const warehouseTypeId = params.warehouse_type_id || "all";
  const warehouseId = query.warehouse_id
    ? String(query.warehouse_id).toLowerCase()
    : "all";
  const dateFrom = query.date_from
    ? String(query.date_from).toLowerCase()
    : "all";
  const dateTo = query.date_to ? String(query.date_to).toLowerCase() : "all";
  const requirementTypeId = query.requirement_type_id
    ? String(query.requirement_type_id).toLowerCase()
    : "false";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${warehouseTypeId}:${warehouseId}:${dateFrom}:${dateTo}:${requirementTypeId}`;
}

/**
 * Cache key builder for warehouse-hurdles listing
 * Includes: userId, roleId, accessKeyId, hurdle_date
 */
export function buildWarehouseHurdleKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.FIND_ALL("warehouse-hurdles");
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const hurdleDate = query.hurdle_date
    ? String(query.hurdle_date).toLowerCase()
    : "all";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${hurdleDate}`;
}

/**
 * Cache key builder for warehouse listing
 * Includes: userId, roleId, accessKeyId, warehouse_id
 */
export function buildWarehouseKey(query: any, params: any, user: any): string {
  const base = CACHE_KEYS.FIND_ALL("warehouse");
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const warehouseTypeId = params.warehouse_type_id || "all";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${warehouseTypeId}`;
}

/**
 * Cache key builder for warehouse employees listing
 * Includes: userId, roleId, accessKeyId, warehouse_id
 */
export function buildWarehouseEmployeeKey(
  query: any,
  params: any,
  user: any,
): string {
  const base = CACHE_KEYS.FIND_ALL("warehouse-employees");
  const userId = user?.id || "all";
  const roleId = user?.role_id || "all";
  const accessKeyId = user?.current_access_key || "all";
  const assignmentDate = query.assignment_date
    ? String(query.assignment_date).toLowerCase()
    : "all";
  return `${base}:${userId}:${roleId}:${accessKeyId}:${assignmentDate}`;
}

// Type for cache key builder functions
export type CacheKeyBuilder = (query: any, params?: any, user?: any) => string;
