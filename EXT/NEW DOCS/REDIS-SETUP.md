# Redis Caching Setup Guide

## Prerequisites

### 1. Install Required NPM Packages

```bash
npm install @nestjs/cache-manager cache-manager cache-manager-redis-store
npm install --save-dev @types/cache-manager
```

### 2. Linux Server Setup (Production)

#### Option A: Using APT (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server redis-tools

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify installation
redis-cli ping
# Should output: PONG
```

#### Option B: Using Docker (Recommended for clean setup)

```bash
docker pull redis:7-alpine
docker run --name redis-prod -d -p 6379:6379 \
  -e REDIS_PASSWORD=your_secure_password \
  redis:7-alpine redis-server --requirepass your_secure_password
```

#### Option C: Compile from Source (for specific version)

```bash
wget http://download.redis.io/redis-stable.tar.gz
tar xzf redis-stable.tar.gz
cd redis-stable
make
sudo make install

# Create systemd service
sudo nano /etc/systemd/system/redis.service
```

### 3. Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
REDIS_DB=0
NODE_ENV=production
```

For production with Docker:

```env
REDIS_HOST=redis-prod  # Docker container name or IP
REDIS_PORT=6379
REDIS_PASSWORD=your_very_secure_password
REDIS_DB=0
```

### 4. Verify Redis Connection

```bash
# Local test
redis-cli -h localhost -p 6379 -a your_password ping
# Output: PONG

# From another machine (if allowed)
redis-cli -h server-ip -p 6379 -a your_password ping
```

### 5. Redis Security for Production

```bash
# Firewall - Allow only from your application server
sudo ufw allow from app_server_ip to any port 6379

# Redis Config - Disable dangerous commands
sudo nano /etc/redis/redis.conf

# Add this to disable flushdb/flushall/keys commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""

# Restart Redis
sudo systemctl restart redis-server
```

### 6. NestJS Configuration Runtime Check

Once installed, your app will automatically:

- Connect to Redis at startup
- Use configured TTLs for different endpoints
- Implement pattern-based cache invalidation
- Emit SSE events when caches are cleared

### 7. Monitor Redis

```bash
# Watch real-time command activity
redis-cli MONITOR

# Check current cache keys
redis-cli KEYS "*"

# Get cache stats
redis-cli INFO stats

# Flush all (DANGEROUS - use carefully)
redis-cli FLUSHDB
```

## Testing Cache (After Setup)

### 1. Local Test

```bash
# Start your NestJS app
npm run start:dev

# In another terminal, curl the heavy endpoint
curl "http://localhost:3000/api/warehouse-requirements/listing?warehouse_type_id=1"

# First call → hits database (500-800ms)
# Subsequent calls → hits Redis cache (<5ms)
```

### 2. Verify Cache Invalidation

```bash
# Trigger an update (create/update/delete)
curl -X POST "http://localhost:3000/api/warehouse-requirements" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Cache should be automatically cleared
# Next call rebuilds cache
```

### 3. Monitor Cache Hits

```bash
# Check Redis commands
redis-cli INFO stats | grep "commands_processed"

# Monitor specific operations
redis-cli MONITOR | grep "warehouse-reqs"
```

## Production Performance Expectations

**Before Caching:**

- First user: 500-800ms (DB query)
- 99 users: Each 500-800ms = 49.5 seconds total

**After Caching:**

- First user: 500-800ms (DB query) = cache stored
- 99 users: Each <5ms (Redis cache hit) = 0.5 seconds total
- **Improvement: 98x faster for subsequent users**

## Troubleshooting

### Redis Connection Refused

```bash
# Check if Redis is running
sudo systemctl status redis-server

# Check port binding
sudo netstat -an | grep 6379

# Restart if needed
sudo systemctl restart redis-server
```

### Cache Not Working

1. Verify Redis is running: `redis-cli PING`
2. Check environment variables are loaded
3. Verify REDIS_HOST and REDIS_PORT are correct
4. Check logs for connection errors
5. Ensure @nestjs/cache-manager is installed

### High Memory Usage

- Set Redis `maxmemory` policy in redis.conf:
  ```
  maxmemory 256mb
  maxmemory-policy allkeys-lru
  ```
- Monitor with: `redis-cli INFO memory`

## Next Steps

1. Install Redis on your Linux server (Option A, B, or C)
2. Configure environment variables
3. Install NPM packages: `npm install @nestjs/cache-manager cache-manager cache-manager-redis-store`
4. Deploy updated code with caching decorators
5. Verify cache hits in logs and Redis CLI
