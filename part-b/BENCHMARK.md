# Optimization Benchmark

## What Was Optimized
Redis caching on `GET /api/products` with `X-Cache` response header.

## Test Conditions
- Tool: `curl` (PowerShell loop)
- Requests: 30 per scenario
- Dataset size at test time: `products=200`, `orders=499+`
- Environment: Windows local machine, Node.js local process, PostgreSQL in Docker, Redis in Docker
- Endpoint tested: `GET /api/products?search=shirt`

## Results

| Metric | Before (DB every time) | After (Redis cache) | Improvement |
|---|---:|---:|---:|
| Mean response time | 11.90ms | 6.48ms | 1.84x faster |
| p95 response time | 14.97ms | 9.18ms | 1.63x faster |
| Query count/request | 2 | 0 (steady-state HIT) | DB reads eliminated on HIT |
| Cache header | `X-Cache: BYPASS` | `X-Cache: HIT` (after warm-up) | N/A |

## How I Measured
1. Disabled cache path by running without `REDIS_URL` (or with Redis unavailable) to collect baseline.
2. Enabled Redis and warmed one request (`MISS`) then measured repeated hits (`HIT`).
3. Captured response times from `curl -w %{time_total}` and query counts from profile logs.
4. Observed first cached-path request at `275ms` with `2 queries` (`MISS`) and subsequent requests at `2-6ms` with `0 queries` (`HIT`).

## Commands
```powershell
# sample command used in loops
curl.exe -s -o NUL -w "%{time_total}`n" "http://localhost:3000/api/products?search=shirt"
```

## Part A Connection
Part A profiling showed product listing repeatedly hitting PostgreSQL and no caching layer. This optimization directly targets that read amplification by moving hot catalog reads to Redis memory with 5-minute TTL.
