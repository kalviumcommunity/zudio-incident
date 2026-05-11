# Optimization Benchmark

## What Was Optimized
Composite index on order history read path: `orders(user_id, created_at DESC)`.

Implementation added in `src/migrations/002_add_idx_orders_user_date.sql`.

## Test Conditions
- Tool used: PostgreSQL `EXPLAIN ANALYZE` + Node.js benchmark harness (`pg` client)
- Number of requests: 50 query executions before + 50 query executions after
- PostgreSQL rows at test time: `products=200`, `orders=500`
- Machine: Windows local dev machine, Node.js `v24.4.0`, local PostgreSQL

## Results

| Metric | Before | After | Improvement |
|--------------------|----------|----------|-------------|
| Mean response time | 86.324ms | 83.713ms | 1.03x |
| Query count/request | 1 | 1 | 1.00x |
| p95 response time | 114.182ms | 102.291ms | 1.12x |
| EXPLAIN execution time | 0.498ms | 0.346ms | 1.44x |

## Query Plan Evidence (EXPLAIN ANALYZE)

Before (no composite index):
```text
->  Seq Scan on orders  (cost=0.00..19.25 rows=15 width=72) (actual time=0.013..0.070 rows=15 loops=1)
Execution Time: 0.498 ms
```

After (with `idx_orders_user_date`):
```text
->  Index Scan using idx_orders_user_date on orders  (cost=0.27..7.07 rows=15 width=72) (actual time=0.016..0.020 rows=15 loops=1)
Execution Time: 0.346 ms
```

## How I Measured
1. Captured row counts using a `pg` script: `products=200`, `orders=500`.
2. Ran `scripts/benchmark_orders_index.js` to collect EXPLAIN ANALYZE before/after and verify scan-method change (`Seq Scan` to `Index Scan`).
3. Ran `scripts/benchmark_orders_index_stats.js` with 50 executions before and 50 after to compute mean and p95 under identical query shape.
4. Isolated before/after by dropping index first, then recreating `idx_orders_user_date` and rerunning the same query.

## Part A Connection
Part A Bug 5 profiled order history as the key performance risk (N+1 path, 106 queries, ~8.5s before fix). After the N+1 fix in Part A, this composite index targets the remaining hot path (`WHERE user_id = $1 ORDER BY created_at DESC`) so user-order pagination keeps predictable latency as table size grows.
