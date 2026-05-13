# Optimization Benchmark

## What Was Optimized

Composite index on orders for the order history access pattern.

## Test Conditions

- Tool used: `EXPLAIN ANALYZE` via Node `pg`
- Number of requests: 1 query plan before and 1 query plan after
- PostgreSQL rows at test time: products=sample seed data, orders=100,000 benchmark orders for `user_id = 1`
- Machine: local Windows workspace environment

## Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Mean response time | 52.636ms | 0.065ms | ~809x |
| Query count/request | 1 | 1 | 1x |
| Planner access path | Parallel Seq Scan on orders | Index Scan using idx_orders_user_date | N/A |

## How I Measured

Before the index, the order history query was measured with `EXPLAIN ANALYZE` against the existing `orders` table access pattern. After adding `CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);`, I reran the same query shape and compared the reported execution time and access path.

## Part A Connection

This optimization directly addresses the order-history bottleneck identified in Part A. The composite index matches the exact filter and sort pattern used by the history query, which is why the planner can avoid the sequential scan and return the first page of orders much faster.
