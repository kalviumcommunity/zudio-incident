# Part B Architecture

## Current Architecture (As-Is)

Internet
    |
    v
+----------------------------------------------+
| Single Node.js Express Server                |
| (routes + business logic + SQL in one app)   |
|                                              |
| - GET /api/orders/history was N+1            |
|   (Part A Bug 5: ~14,200ms, 200+ queries)    |
| - No cache layer for product catalog          |
|   (Part A profile: each request hits DB)      |
| - Single process is a SPOF                    |
|   (crash => full outage)                      |
+----------------------------------------------+
    |
    v
+----------------------------------------------+
| Single PostgreSQL Instance                    |
| (reads + writes on same primary)              |
|                                              |
| - SQL injection was possible in search         |
|   before parameterization (Part A Bug 1)      |
| - Plaintext credential risk in DB exposure     |
|   before bcrypt (Part A Bug 2)                |
| - No read/write separation under load          |
|   (checkout writes compete with reads)         |
+----------------------------------------------+

## Scaled Architecture (Target for 1 Lakh Users)

Internet Users (1,00,000 concurrent)
          |
          v
+----------------------------------------------+
| CDN (CloudFront/Nginx static tier)            |
| - Product images / static assets               |
| - Cache-Control headers                        |
+----------------------------------------------+
          |
          v
+----------------------------------------------+
| Load Balancer (Nginx/ALB)                      |
| - TLS termination                              |
| - Health checks + rate limiting                |
| - Round robin to stateless app nodes           |
+----------------------------------------------+
      |               |               |
      v               v               v
+-------------+ +-------------+ +-------------+
| Node App 1  | | Node App 2  | | Node App 3  |
| Stateless   | | Stateless   | | Stateless   |
+-------------+ +-------------+ +-------------+
      |               |               |
      +---------------+---------------+
                      |
                      v
+----------------------------------------------+
| Redis Cluster                                 |
| - Product cache (TTL 300s)                    |
| - Coupon lock (SETNX style lock)              |
| - Session/JWT blacklist support                |
+----------------------------------------------+
                      |
                      v
+----------------------------------------------+      +----------------------+
| PostgreSQL Primary                            | ---> | Read Replica 1       |
| - Writes, transactions, stock updates         |      | Product browsing     |
+----------------------------------------------+      +----------------------+
                      |
                      +------------------------------> +----------------------+
                                                     | Read Replica 2        |
                                                     | Order history reads   |
                                                     +----------------------+

## Architecture Decisions and Part A Evidence

### CDN
Part A showed the app is a single Node process; static image transfer competes with API CPU and I/O. Moving images to CDN cuts origin load and protects API latency during sale spikes.

### Load Balancer + Multiple Stateless Nodes
Part A baseline had one Express process, which is a hard single-point-of-failure. A load balancer with health checks keeps service alive when one node crashes and spreads burst traffic across multiple instances.

### Redis Product Cache
Part A profile showed products endpoint hitting DB on every read. Redis with 300s TTL shifts repeated reads to memory and reduces database pressure dramatically for read-heavy traffic.

### Read Replicas
Part A bugs and profiling proved checkout path must stay transactional while order history is read-heavy. Splitting reads to replicas isolates write throughput on primary during peak traffic.

### Redis Coupon Lock + PostgreSQL Transaction
Part A Bug 3 (double discount) came from non-atomic coupon consume flow. Redis lock prevents high-concurrency coupon storms from saturating DB locks, while PostgreSQL transaction still guarantees stock/order atomicity.

## Tradeoff: Redis Lock vs SELECT FOR UPDATE

`SELECT ... FOR UPDATE` is valid for atomic coupon use at low concurrency and keeps consistency within PostgreSQL. Under very high contention, lock waits can consume DB connections and increase latency; Redis lock rejects duplicates early at memory speed while DB remains focused on final order transaction work.
