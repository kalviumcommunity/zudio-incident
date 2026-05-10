# Optimization Benchmark

## What Was Optimized

Composite index on orders(user_id, created_at DESC) combined with JOIN query optimization for order history retrieval.

---

## Test Conditions

- Tool used: PostgreSQL EXPLAIN ANALYZE
- Number of requests tested: 20
- PostgreSQL rows at test time:
  - products = 100+
  - orders = 50+
- Machine:
  - Windows 11
  - Intel i5 Processor
  - 8GB RAM
- Database: PostgreSQL 15

---

## Results

| Metric | Before | After | Improvement |
|---|---|---|---|
| Mean response time | 210ms | 48ms | 4.3× faster |
| Query count/request | 201 | 2 | 100× reduction |
| Database load | High | Reduced | Significant |

---

## Query Plan Observation

Before optimization:
- Sequential scans executed repeatedly
- Queries executed inside loops (N+1 problem)
- High database overhead during order history retrieval

After optimization:
- PostgreSQL uses indexed lookup on orders(user_id, created_at DESC)
- Single JOIN query fetches complete order history
- Reduced repeated database scanning

---

## How I Measured

1. Used profiling middleware from Part A to record query counts and response times.
2. Executed EXPLAIN ANALYZE before adding the composite index.
3. Added:
   CREATE INDEX idx_orders_user_date
   ON orders(user_id, created_at DESC);
4. Re-ran EXPLAIN ANALYZE after optimization.
5. Compared execution time and query count before vs after optimization.

---

## Part A Connection

Part A profiling identified the order history endpoint as suffering from an N+1 query issue.
The endpoint executed database queries inside nested loops, causing response time and query count to scale linearly with data size.

This optimization directly addresses that bottleneck by:
- replacing repeated queries with JOINs
- adding a composite index for efficient filtering and sorting

The result is significantly lower database load and much faster response times during high traffic conditions.