# The Zudio Incident - Part B Architecture

## Step 2 - Current Architecture (As-Is)

This diagram captures the state immediately after Part A bug fixes and before any scale redesign.

```text
Internet Users
	|
	v
+------------------------------------------------------------------+
| Single Node.js Express Server (1 process, 1 instance)            |
| - Routes + business logic + database access in one runtime       |
| - No cache layer in front of product reads                       |
| - No load balancer, so all traffic enters one process            |
|                                                                  |
| [WARN][Part A Bug 5] Order history path previously hit           |
| 106 queries and ~8.5s latency (N+1 pattern before fix).          |
| [WARN][Part A profiling] GET /api/products still queries DB      |
| directly per request because no cache layer exists.              |
| [WARN][Part A architecture] Single process is a SPOF:            |
| one crash or event-loop stall causes full API outage.            |
+------------------------------------------------------------------+
	|
	v
+------------------------------------------------------------------+
| Single PostgreSQL Instance                                        |
| - Same instance handles both reads and writes                     |
| - Product reads, order history reads, and checkout writes share   |
|   the same DB connection budget                                   |
|                                                                  |
| [WARN][Part A Bug 3] Coupon redemption required atomic handling,  |
| proving checkout has high-concurrency contention points.          |
| [WARN][Part A Bug 4] Inventory correctness depended on app-path   |
| logic, showing DB workload is tightly coupled to checkout flow.   |
| [WARN][Part A profiling] Read-heavy and write-heavy traffic       |
| compete on one DB server with no read/write split.               |
+------------------------------------------------------------------+

Absence explicitly shown above:
- No caching layer between app and database.
- No load balancer in front of Node.js.

## Step 3 - Scaled Architecture for 1 Lakh Concurrent Users

```text
Internet Users (100,000 concurrent)
		   |
		   v
+----------------------------------------------+
| CDN / Edge Cache                             |
| Static assets + product image delivery       |
+----------------------------------------------+
		   |
		   v
+----------------------------------------------+
| Load Balancer                                |
| TLS termination + health checks + rate limit |
+----------------------------------------------+
	  |                |                |
	  v                v                v
+------------+   +------------+   +------------+
| Node App 1 |   | Node App 2 |   | Node App 3 |
| Stateless  |   | Stateless  |   | Stateless  |
+------------+   +------------+   +------------+
	  \              |               /
	   \             |              /
		v            v             v
+----------------------------------------------+
| Redis Cluster                                 |
| Product cache (TTL 300s) + coupon lock        |
+----------------------------------------------+
					  |
					  v
+----------------------------------------------+      +--------------------+
| PostgreSQL Primary                            |----->| Read Replica 1     |
| Writes + transactions                         |      | Product list reads  |
+----------------------------------------------+      +--------------------+
					  |
					  +------------------------------->+--------------------+
													 | Read Replica 2     |
													 | Order history reads |
													 +--------------------+
```

### CDN (Static Assets + Product Images)
Part A showed the API runs as a single process, so serving static files from the same runtime risks stealing I/O and CPU from API paths during spikes. A CDN absorbs repeated image requests at the edge and reduces origin load so API latency remains stable.

### Load Balancer
Part A architecture was a single-node entry point, which means one crash equals full outage. A load balancer distributes traffic across instances and removes unhealthy nodes automatically, preventing total downtime on single-instance failure.

### Multiple Stateless Node.js Instances
Part A was constrained to one Node.js process, which cannot scale linearly to sale-event concurrency. Stateless instances allow horizontal scale-out and safe rolling restarts because no request-critical state is kept in process memory.

### Redis Cluster (Catalog Cache + Coupon Distributed Lock)
Part A profiling established that GET /api/products repeatedly hit PostgreSQL with no cache layer, increasing read pressure unnecessarily. Redis serves repeated catalog reads from memory and supports distributed coupon locking so high-concurrency checkout avoids heavy DB lock queues.

### PostgreSQL Primary (Writes + Transactions)
Part A Bug 3 and Bug 4 proved checkout correctness depends on atomic transactional writes (coupon claim, order write, stock update). Keeping all writes on a single primary preserves strong consistency for business-critical state transitions.

### PostgreSQL Read Replicas (Read/Write Separation)
Part A Bug 5 identified read-heavy order history behavior as a major performance hotspot before optimization. Sending product and history reads to replicas isolates heavy read traffic from write transactions so checkout performance remains stable under load.

## Decision Challenge - SELECT FOR UPDATE vs Redis SETNX

SELECT FOR UPDATE is a valid correctness mechanism because PostgreSQL row locking can serialize coupon redemption safely. At 1 lakh-user burst traffic, Redis SETNX is preferred for lock admission because it resolves contention in memory speed and avoids consuming primary DB connections while requests wait.
