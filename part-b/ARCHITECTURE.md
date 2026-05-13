# Part B Architecture

## Current Architecture

```text
Internet
    |
    v
+---------------------------------------+
| Single Node.js Express Server         |
| 1 process, 1 dyno, no clustering      |
|                                       |
| - Routes + business logic + DB queries| <- No separation of concerns
| - No caching layer                    | <- Every request hits PostgreSQL
| - No load balancer                    | <- Single point of failure
| - Synchronous N+1 queries             | <- Part A measured ~14s order history
+---------------------------------------+
    |
    v
+---------------------------------------+
| Single PostgreSQL Instance            |
| Reads and writes on same server       |
|                                       |
| - No indexes on FK columns            | <- Full scans on user/order lookups
| - Missing NOT NULL constraints         | <- Orphaned / invalid rows possible
| - Denormalized order_items rows        | <- Product name/price duplicated
+---------------------------------------+
```

### What Part A proved

- The order history path is dominated by a read-heavy join pattern that becomes slow without the right index support.
- Checkout and coupon handling are vulnerable to race conditions when multiple requests hit the same code path concurrently.
- Product reads are repeated often enough that they should not always reach PostgreSQL.
- The application is currently a single runtime instance, so one failure takes down the entire API.

## Scaled Architecture For 1 Lakh Users

```text
Internet Users
    |
    v
+---------------------------------------+
| CDN / Edge Cache                      |
| Static assets, product images         |
| Cache-Control headers                 |
+---------------------------------------+
    |
    v
+---------------------------------------+
| Load Balancer                         |
| SSL termination, health checks        |
| Round-robin across app instances      |
+---------------------------------------+
    |
    +------------------+------------------+
    |                  |                  |
    v                  v                  v
+-----------+    +-----------+    +-----------+
| Node App 1|    | Node App 2|    | Node App 3|
| Stateless |    | Stateless |    | Stateless |
+-----------+    +-----------+    +-----------+
    \              |              /
     \             |             /
      v            v            v
+---------------------------------------+
| Redis Cluster                         |
| Product cache, coupon lock, sessions  |
+---------------------------------------+
                |
                v
+---------------------------------------+      +----------------------+
| PostgreSQL Primary                    | ---> | Read Replica 1       |
| Writes, transactions, stock updates   |      | Product reads        |
+---------------------------------------+      +----------------------+
                |
                +-----------------------> +----------------------+
                                       | Read Replica 2       |
                                       | Order history reads  |
                                       +----------------------+
```

### Redis Cache

Added because Part A showed `GET /api/products` going straight to PostgreSQL on every request. A cache-aside layer keeps the product catalog hot in memory and lets the app serve repeated catalog reads without burning database connections.

### Load Balancer

Added because the current app is a single Node.js process with no horizontal scaling. A load balancer spreads traffic across multiple stateless instances and removes a crashed node from rotation instead of taking the site down.

### Stateless Node Instances

Added because Part A showed the backend work is request-driven and can be split across identical workers. Keeping each instance stateless makes scaling and failover predictable under sale traffic.

### PostgreSQL Primary + Read Replicas

Added because Part A exposed both read-heavy and write-heavy flows, and they should not compete on the same connection pool. Product browsing and order history can be routed to replicas, while checkout stays on the primary for transactional safety.

### CDN / Edge Cache

Added because product images and other static assets do not need to consume Node.js CPU or PostgreSQL capacity. Offloading them reduces origin traffic and protects the API layer during spikes.

### Coupon Locking Strategy

For coupon redemption, Redis `SETNX` is the better fit at high concurrency because it resolves contention in memory. PostgreSQL `SELECT ... FOR UPDATE` is valid at low load, but it holds a database connection while requests queue, which is the wrong bottleneck during a sale event.
