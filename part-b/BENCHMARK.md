# Optimization Benchmark

## What Was Optimized

Composite index on `orders(user_id, created_at DESC)` for the order-history query.

## Test Conditions

- Tool used: `psql`
- Number of requests: 1 `EXPLAIN ANALYZE` run before the index, 1 `EXPLAIN ANALYZE` run after the index
- PostgreSQL rows at test time: products=200, orders=504, order_items=2528
- Machine: Windows laptop running Git Bash against local PostgreSQL 18.1

## Results

| Metric              | Before   | After    | Improvement |
| ------------------- | -------- | -------- | ----------- |
| Mean response time  | 3.968 ms | 3.816 ms | 1.04x       |
| Query count/request | 1        | 1        | 1.00x       |
| Shared buffers      | 53       | 43       | 1.23x       |

## How I Measured

I ran the exact order-history query used by `GET /api/orders/history` for `user_id = 1` with `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` before adding the index, then created the index with `CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, created_at DESC);` and ran `ANALYZE orders;` before rerunning the same `EXPLAIN ANALYZE` statement.

The query shape was kept identical in both runs: the same `LEFT JOIN` against `order_items` and `products`, the same `ORDER BY o.created_at DESC, oi.id ASC`, and the same `LIMIT 20 OFFSET 0`.

## Part A Connection

This optimization targets Part A Bug 5, where `GET /api/orders/history` showed a `1+N+M` read pattern and the profiling output reported `15ms` with `1+N+M queries`.

The index does not remove the join itself, but it gives PostgreSQL a cheaper way to find a user's orders in recency order, which reduces buffer churn and keeps the history path from scaling as badly when the orders table grows.
