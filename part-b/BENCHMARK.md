## Optimization Benchmark

**What was optimized:** Redis cache on GET /api/products (cache-aside, 5 minute TTL)

## Test Conditions (how to reproduce)
- Tool: `autocannon` or repeated `curl` requests
- Server: run locally with `npm start` (uses `src/server.js`)
- Redis: local Redis at `redis://localhost:6379` (or set `REDIS_URL`)
- Products table size: (record the number of rows you seeded)

## Commands

Start the server:

```bash
npm start
```

Flush Redis before the "before" run (ensure cold cache):

```bash
redis-cli FLUSHALL
```

Run a short benchmark (example using autocannon):

```bash
npx autocannon -c 50 -d 10 http://localhost:3000/api/products
```

Observe `X-Cache` header with curl to confirm HIT/MISS:

```bash
curl -i "http://localhost:3000/api/products?limit=10&offset=0"
```

## Results (fill in your measured numbers)

| Metric             | Before (DB every time) | After (Redis cache) | Improvement |
|--------------------|------------------------|---------------------|-------------|
| Mean response time | ___ms                  | ___ms               | ___×        |
| p99 response time  | ___ms                  | ___ms               | ___×        |
| DB queries/min     | ___                    | ___                 | ___×        |
| Throughput         | ___ req/s              | ___ req/s           | ___×        |

## How I Measured
- Cold cache: `redis-cli FLUSHALL`, then start benchmark and record metrics.
- Warm cache: after the first request(s) populate Redis, re-run benchmark and observe `X-Cache: HIT`.
- Use the `X-Cache` header to count cache hits vs misses.

## Part A Connection
This optimization directly addresses the Part A finding where `GET /api/products` hit the database on every request, causing high DB load and slow mean response times. Redis cache reduces repeated DB queries and serves subsequent requests from memory.

## Notes
- The repository already includes the Redis client implementation at `src/cache/redisClient.js` and the `products` controller uses cache-aside pattern with a 5-minute TTL and `X-Cache` header.
