# Redis Installation on Windows (Local Development)

Since you're on Windows and don't have Redis, here are **3 options** (from easiest to most flexible):

---

## **Option 1: Docker (Recommended - Easiest) ⭐**

### Prerequisites

- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Docker runs on Windows 10+ (Home/Pro/Enterprise)

### Steps

1. **Pull Redis image**

```bash
docker pull redis:7-alpine
```

2. **Run Redis container**

```bash
# Simple (no password)
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine

# With password (recommended)
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine redis-server --appendonly yes
```

3. **Verify it's running**

```bash
docker ps
# Should see redis-dev container running

# Connect to your app
# REDIS_HOST=localhost
# REDIS_PORT=6379
```

4. **Stop/Start container**

```bash
docker stop redis-dev
docker start redis-dev
```

5. **Monitor Redis from command line**

```bash
# Inside the container
docker exec -it redis-dev redis-cli
redis-cli> PING
# Output: PONG

# Get cache keys
redis-cli> KEYS "*"

# Monitor live activity
redis-cli> MONITOR
```

**Advantages:**

- ✅ No local Redis installation needed
- ✅ Exact production environment
- ✅ Easy to stop/restart
- ✅ Isolated from system

---

## **Option 2: Windows Subsystem for Linux 2 (WSL2)**

If you already have WSL2 installed with Ubuntu:

```bash
# Inside WSL2 Ubuntu terminal
sudo apt update
sudo apt install redis-server

# Start Redis
redis-server

# In another WSL2 terminal
redis-cli PING
# Output: PONG
```

Then in your `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## **Option 3: Memurai (Windows Native - Advanced)**

[Memurai](https://www.memurai.com/) is a Windows native Redis package.

1. Download from https://www.memurai.com/
2. Run installer
3. Redis starts as Windows Service automatically
4. Commands:

```bash
# Start
net start Memurai

# Stop
net stop Memurai

# Connect
redis-cli PING
```

---

## **Quick Start Guide (Docker Method)**

### **Step 1: Install Docker Desktop**

- Download: https://www.docker.com/products/docker-desktop/
- Install and restart Windows

### **Step 2: Start Redis in PowerShell/CMD**

```bash
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine
```

### **Step 3: Configure your app `.env`**

```env
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### **Step 4: Install NPM packages**

```bash
npm install @nestjs/cache-manager cache-manager cache-manager-redis-store
```

### **Step 5: Run your NestJS app**

```bash
npm run start:dev
```

### **Step 6: Test cache**

```bash
# First request (hits DB, caches result)
# Response time: ~500-800ms
curl http://localhost:3000/api/warehouse-requirements/listing?warehouse_type_id=1

# Second request (hits Redis cache)
# Response time: <5ms
curl http://localhost:3000/api/warehouse-requirements/listing?warehouse_type_id=1
```

### **Step 7: Monitor Redis**

```bash
# In a new PowerShell/CMD window
docker exec -it redis-dev redis-cli

# Inside redis-cli shell
PING
# Output: PONG

# Watch active commands
MONITOR

# View all cached keys
KEYS "*"

# Check cache stats
INFO stats
```

---

## **Troubleshooting Windows + Docker**

### **Docker not found error**

```bash
# PowerShell error: "docker : The term 'docker' is not recognized"
# Solution: Restart PowerShell after Docker Desktop installation
```

### **Port 6379 already in use**

```bash
# Use a different port
docker run --name redis-dev -d -p 6380:6379 redis:7-alpine

# Update .env
REDIS_PORT=6380
```

### **Redis container won't start**

```bash
# Remove old container
docker rm redis-dev

# Try again
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine
```

### **Connection refused from app**

```bash
# Check container running
docker ps | findstr redis

# Check logs
docker logs redis-dev

# Connect from PowerShell to test
docker exec -it redis-dev redis-cli PING
```

---

## **Environment Variables for Local Development**

Create `.env.development` or update `.env`:

```env
# Local Development
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Or with Docker on different port
# REDIS_PORT=6380
```

For production on Linux server:

```env
# Production Linux
NODE_ENV=production
REDIS_HOST=<your-linux-server-ip>
REDIS_PORT=6379
REDIS_PASSWORD=<your-secure-password>
REDIS_DB=0
```

---

## **Docker Commands Reference**

```bash
# Start Redis
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine

# Stop Redis
docker stop redis-dev

# Start existing container
docker start redis-dev

# Remove container
docker rm redis-dev

# View logs
docker logs redis-dev

# Connect to Redis CLI
docker exec -it redis-dev redis-cli

# Check if running
docker ps

# Restart container
docker restart redis-dev
```

---

## **Next Steps**

1. **Choose your method** (Docker recommended)
2. **Setup Redis locally** using chosen method
3. **Update `.env`** with Redis connection details
4. **Install packages**: `npm install @nestjs/cache-manager cache-manager cache-manager-redis-store`
5. **Run app**: `npm run start:dev`
6. **Test cache** with curl commands above
7. **Monitor** with `redis-cli MONITOR`

---

## **Development Workflow**

**Daily development:**

```bash
# Terminal 1: Start Redis
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine

# Terminal 2: Start NestJS app
npm run start:dev

# Terminal 3 (optional): Monitor Redis
docker exec -it redis-dev redis-cli MONITOR

# When done
docker stop redis-dev
```

---

## **Expected Performance**

| Scenario                | Time      | Status           |
| ----------------------- | --------- | ---------------- |
| No cache (1st req)      | 500-800ms | From DB          |
| Cache hit (2nd+ rqeq)   | <5ms      | From Redis       |
| Create/Update/Delete    | Instant   | Clears cache     |
| Next request after CRUD | 500-800ms | Rebuilds from DB |

---

**Ready to try Docker?** Just run:

```bash
docker pull redis:7-alpine
docker run --name redis-dev -d -p 6379:6379 redis:7-alpine
```

Then update your `.env` and start developing! 🚀
