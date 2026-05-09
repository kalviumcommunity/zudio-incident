# Part B Architecture Redesign

## Current Architecture (Before Redesign)

```
Internet
  |
  v
+----------------------------------+
| Single Node.js Express Server     |
| All API routes in one process     |
| No cache layer                    |
| No load balancer                  |
+----------------------------------+
  |   ! Part A Bug 5: GET /api/orders/history produced 301 queries for a 50-order user,
  |   !     so one slow request can monopolize the only app process.
  |   ! Part A profiling: GET /api/products always hit PostgreSQL (1 query/request), so
  |   !     the app cannot absorb repeated catalog reads without hammering the DB.
  v
+----------------------------------+
| Single PostgreSQL Instance        |
| Reads and writes share one tier   |
+----------------------------------+
  ! Part A Bug 4: checkout requires stock updates, coupon redemption, and order insert
  !   to stay atomic; one database instance becomes the write bottleneck under sale load.
  ! Part A Bug 5: order history joins orders, order_items, and products in one hot path,
  !   so every spike lands directly on the same database.
```

### Weaknesses Called Out From Part A

- No horizontal scaling: there is no load balancer and only one Node.js process, so a crash or memory leak becomes a full outage.
- No caching: Part A profiling showed GET /api/products always reached PostgreSQL, which means repeated catalog traffic is paid for on every request.
- No read/write isolation: Part A Bug 4 and Bug 5 both hit the same Postgres instance, so checkout spikes and history reads compete for the same resources.

## Proposed Architecture (For 1 Lakh Concurrent Users)

```
Internet
  |
  v
+----------------------------------+
| CDN                              |
| Static assets + product images   |
+----------------------------------+
  ! Part A profiling showed product reads were hot even when the response was small; pushing images and static assets to a CDN keeps that traffic out of the app tier.
  |
  v
+----------------------------------+
| Load Balancer                    |
| Routes traffic across replicas   |
+----------------------------------+
  ! Part A Bug 5 showed a single request can explode into hundreds of queries, so load balancing is required to keep one slow request from taking down the whole API.
  |
  +-------------------------------+-------------------------------+-------------------------------+
  |                               |                               |
  v                               v                               v
+----------------------+   +----------------------+   +----------------------+
| Node.js Instance 1   |   | Node.js Instance 2   |   | Node.js Instance 3   |
| Stateless Express    |   | Stateless Express    |   | Stateless Express    |
+----------------------+   +----------------------+   +----------------------+
  ! Part A Bug 4 forced checkout to run inside a transaction, which is exactly why the app layer must be stateless: any instance can process the request as long as Postgres owns the atomic write.
  ! Part A Bug 5 exposed a slow history endpoint, so three replicas let one expensive request not block all catalog traffic.
            |                               |                               |
            +---------------+---------------+---------------+---------------+
                            |
                            v
                    +------------------+
                    | Redis Cluster     |
                    | Product cache     |
                    | Coupon lock       |
                    +------------------+
                    ! Part A profiling showed GET /api/products hit PostgreSQL on every request, so Redis absorbs repeat catalog reads.
                    ! Part A Bug 3 was a coupon race condition, and a distributed lock in Redis prevents multiple concurrent checkouts from redeeming the same coupon.
                            |
                            v
                    +------------------+
                    | PostgreSQL Primary|
                    | Writes + txns     |
                    +------------------+
                    ! Part A Bug 4 requires atomic stock decrements, order inserts, and coupon updates, so all write traffic stays on the primary.
                            |
                +-----------+------------+
                |                        |
                v                        v
      +----------------------+  +----------------------+
      | PostgreSQL Replica 1 |  | PostgreSQL Replica 2 |
      | Product reads        |  | Order history reads  |
      +----------------------+  +----------------------+
      ! Part A Bug 5 was a read-heavy order-history path, so replicas isolate reporting and browsing from write transactions.
      ! Product list traffic also becomes a replica-friendly read path once Redis misses fall through to Postgres.
```

### Component Justifications

### CDN
Added because Part A profiling showed that product reads are a hot path and the current stack serves everything through the origin. Serving static assets and product images from a CDN reduces origin bandwidth and keeps the Node.js instances focused on API work.

### Load Balancer
Added because Part A Bug 5 proved that one request can expand into hundreds of database queries, which makes a single application process a serious bottleneck. A load balancer lets us spread traffic across replicas and removes the single point of failure from the web tier.

### Stateless Node.js Instances
Added because Part A Bug 4 requires checkout logic to be transactional and repeatable, not pinned to one process. Three stateless replicas mean the API can survive a crash, and any instance can accept checkout or browsing traffic as long as it can reach the shared data stores.

### Redis Cluster
Added because Part A profiling showed GET /api/products always touched PostgreSQL even though the result changes slowly. Redis turns catalog reads into memory hits, and the distributed lock prevents the coupon race condition from Part A Bug 3 from being replayed across multiple app replicas.

### PostgreSQL Primary
Added because Part A Bug 4 depends on atomic stock decrements, coupon redemption, and order creation. Keeping all writes on a primary preserves transaction ordering and prevents replica lag from corrupting checkout state.

### PostgreSQL Read Replicas
Added because Part A Bug 5 showed the order-history path is read-heavy and expensive when it runs against the same database that handles checkout. Routing product browsing and order-history reads to replicas keeps sale traffic from starving the primary during high-write windows.
