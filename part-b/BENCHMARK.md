# Optimization Benchmark

## What Was Optimized
Composite index on orders: `CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC)`.

## Test Conditions
- Tool used: `psql` with `EXPLAIN (ANALYZE, BUFFERS)`.
- Number of requests: 1 representative order-history query before and after the index.
- PostgreSQL rows at test time: products=200, orders=550498, order_items=52522.
- Machine: Windows workstation, local PostgreSQL 17 server.

## Results

| Metric              | Before   | After    | Improvement |
|---------------------|----------|----------|-------------|
| Mean response time  | 212.515 ms | 20.492 ms | 10.37x      |
| Query count/request | 1        | 1        | 1x          |
| Orders table buffers| 6796     | 628      | 10.82x      |

## How I Measured
I first expanded the same local database with additional synthetic orders so the orders table was large enough for the scan difference to matter, then dropped the composite index and captured a baseline `EXPLAIN (ANALYZE, BUFFERS)` for the exact order-history query from `src/controllers/order.controller.js` at `user_id = 1`. After that I created `idx_orders_user_date`, ran `ANALYZE`, and executed the same query again so the comparison isolates the effect of the index on the same workload.

## Part A Connection
Part A Bug 5 documented the N+1 order-history hotspot and showed the query path was the slowest read endpoint in the system. The baseline plan confirmed the orders table was being read with a sequential scan, and the composite index removes that scan on the hot `WHERE o.user_id = $1 ORDER BY o.created_at DESC` path.
