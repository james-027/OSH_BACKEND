# Cache Debugging & Redis Testing Guide

## Environment Variables Required

Add these to your `.env` file:

```env
# Redis Configuration (REQUIRED for caching to work)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password_if_needed
REDIS_DB=0
NODE_ENV=production
```

## Debug Endpoints

Once the app is running, use these endpoints to test cache functionality:

### 1. Check Cache Configuration

```bash
GET http://localhost:3000/debug/cache/info

# Response shows:
# {
#   "store": "RedisStore" | "MemoryStore",      # ← Should be RedisStore
#   "redis_host": "localhost",
#   "redis_port": "6379",
#   "redis_password": "***set***" | "not-set",
#   "redis_db": "0",
#   "node_env": "production"
# }
```

### 2. Test Cache SET/GET

```bash
GET http://localhost:3000/debug/cache/test?key=my-test:key&value=test-data&ttl=300

# Should return:
# {
#   "status": "success",
#   "operation": "set+get",
#   "key": "my-test:key",
#   "value": {
#     "message": "test-data",
#     "timestamp": "2025-04-05T12:15:30.000Z"
#   }
# }
```

### 3. Verify in Redis CLI

```bash
# Connect to Redis
redis-cli -h localhost -p 6379 -a your_password

# List all keys
KEYS *

# Get a specific key
GET my-test:key
```

### 4. Flush Cache (for testing)

```bash
POST http://localhost:3000/debug/cache/flush

# Response:
# {
#   "status": "success",
#   "message": "Cache flushed"
# }
```

## Troubleshooting

### Cache store shows "MemoryStore" instead of "RedisStore"

**Problem:** Redis is not connecting properly
**Solution:**

1. Verify Redis is running:
   ```bash
   docker ps | grep redis
   # or
   redis-cli ping  # Should return PONG
   ```
2. Check environment variables are set:
   ```bash
   echo $REDIS_HOST
   echo $REDIS_PORT
   ```
3. Restart the application after setting env vars

### Cache test returns error

**Problem:** Cache operations failing
**Log details:**

- Check app console for error messages
- Verify Redis is accessible: `redis-cli -h localhost -p 6379 ping`
- Check network connectivity if Redis is remote

### Cached data not appearing in Redis

**Problem:** Cache writes but Redis CLI shows no keys
**Possible causes:**

1. Using different Redis instances (verify host/port/password)
2. Cache TTL expired (default 300s / 5 min)
3. Cache key not being generated correctly

### Endpoint returns "Cache GET failed: key not found"

**Problem:** SET works but GET fails
**Solution:**

1. Check Redis is actually storing data: `redis-cli DBSIZE`
2. Verify TTL value (in milliseconds): `redis-cli TTL key-name`
3. Check Redis hasn't been flushed by another process

## Docker Redis Setup (if needed)

```bash
# Run Redis container
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine

# Verify
docker exec redis-dev redis-cli ping  # Should return PONG

# Access Redis CLI
docker exec -it redis-dev redis-cli
```

## Testing Actual Cached Endpoints

After verifying cache works with debug endpoints:

```bash
# First request (cache miss, slower)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/req-transaction-headers/group-by-trans-number?trans_number=RBC012025-0005"

# Check Redis for cache key
redis-cli KEYS "req-trans:*"

# Second request (should be faster, cache hit)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/req-transaction-headers/group-by-trans-number?trans_number=RBC012025-0005"
```

## Important Notes

- **Static Cache Keys & Dynamic Parameters**: Endpoints with query parameters (trans_number, date_from, date_to) currently use static cache keys. This means different parameters hit the same cache. To fix this, query parameters should be included in the cache key strategy.

- **Cache TTLs**:

  - Heavy queries: 300s (5 minutes)
  - General queries: 300s (5 minutes)
  - Counts/Dashboards: 180s (3 minutes)

- **Cache Invalidation**: When data is created/updated/deleted, related caches are automatically invalidated by CacheInvalidationService.
