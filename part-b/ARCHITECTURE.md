# Current Architecture

```text
Internet
	|
	v
┌──────────────────────────────────────────────┐
│          Single Node.js Express Server       │  ←  [Part A Bug 1] Product search is built with string interpolation, so one app process exposes the vulnerable code path.
│          All API logic in one process        │  ←  [Part A Bug 2] Passwords are handled in plaintext in the app layer.
│                                              │  ←  [Part A Bug 3] Coupon redemption is not atomic; concurrent requests can race in the same process.
│                                              │  ←  [Part A Bug 4] Inventory is never decremented after purchase.
│                                              │  ←  [Part A Bug 5 / profiling: 1+N+M queries] Order history does per-order and per-item lookups, so latency grows with data size.
└──────────────────────────────────────────────┘
	|
	v
┌──────────────────────────────────────────────┐
│            Single PostgreSQL Instance        │  ←  [Part A Bug 1] The database receives unsafe search SQL from the app.
│                                              │  ←  [Part A Bug 2] Plaintext credentials are stored directly in `users`.
│                                              │  ←  [Part A Bug 3] Coupon state updates are not wrapped in a transaction/row lock.
│                                              │  ←  [Part A Bug 4] Stock remains unchanged after checkout, so the database never reflects sales.
│                                              │  ←  [Part A Bug 5 / profiling: 1+N+M queries] Repeated reads amplify DB load for order history.
└──────────────────────────────────────────────┘
```

## Missing Layers

```text
Internet
	|
	v
┌──────────────────────────────────────────────┐
│          Single Node.js Express Server       │
└──────────────────────────────────────────────┘
	|
	v
┌──────────────────────────────────────────────┐
│            Single PostgreSQL Instance        │
└──────────────────────────────────────────────┘
```

There is no caching layer between the app and PostgreSQL, so repeated reads still hit the database directly. That matters most for [Part A Bug 5 / profiling: 1+N+M queries](../AUDIT.md), where the current order-history path scales linearly with data size.

There is also no load balancer in front of the server, so the single Express process remains the only entry point for traffic. That makes every Part A weakness, especially [Part A Bug 1](../AUDIT.md) through [Part A Bug 5](../AUDIT.md), a single-process bottleneck.

## Proposed Architecture for 1 Lakh Users

```text
Users
	|
	v
┌──────────────────────────────────────────────┐
│ CDN                                          │
│ Static assets + product images               │
└──────────────────────────────────────────────┘
	|
	v
┌──────────────────────────────────────────────┐
│ Load Balancer                                │
│ Routes traffic across Node.js instances      │
└──────────────────────────────────────────────┘
	|
	+--------------------+--------------------+
	|                    |                    |
	v                    v                    v
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Node.js #1     │  │ Node.js #2     │  │ Node.js #3     │
│ Stateless API  │  │ Stateless API  │  │ Stateless API  │
└────────────────┘  └────────────────┘  └────────────────┘
			 \               |               /
			  \              |              /
				v             v             v
			┌──────────────────────────────────┐
			│ Redis Cluster                    │
			│ Product cache + coupon lock      │
			└──────────────────────────────────┘
							 |
							 v
			┌──────────────────────────────────┐
			│ PostgreSQL Primary               │
			│ Writes + transactions            │
			└──────────────────────────────────┘
							 |
			 +-----------+-----------+
			 |                       |
			 v                       v
┌────────────────────────┐  ┌────────────────────────┐
│ PostgreSQL Read Replica │  │ PostgreSQL Read Replica │
│ Product reads           │  │ Order history reads     │
└────────────────────────┘  └────────────────────────┘
```

### CDN

Added because Part A showed the product listing endpoint returning a large payload with 20 products and a 169ms response time, so static assets should not ride the origin path on every page view. Offloading product images and other static files to a CDN reduces repeated origin requests and keeps the application and database focused on dynamic work.

### Load Balancer

Added because Part A exposed the risk of a single Express process being the only entry point, which makes every bug and slowdown a single point of failure. A load balancer spreads traffic across multiple instances so one crashed or overloaded node does not take the store offline.

### Stateless Node.js Instances

Added because Part A Bug 3 and Bug 4 both depend on request handling that is currently concentrated in one app process, where coupon redemption and inventory updates are performed in-line. Making the Node.js tier stateless lets any instance serve any request, which is required before scale-out can actually protect checkout and browsing traffic.

### Redis Cluster

Added because Part A profiling showed `GET /api/products` and `GET /api/orders/history` still relying on live database reads, with order history specifically showing a `1+N+M` query pattern. Redis gives us a fast shared cache for product reads and a distributed lock for coupon redemption, which directly addresses Part A Bug 5 and the race described in Part A Bug 3.

### PostgreSQL Primary

Added because Part A Bug 3 and Bug 4 both require atomic writes: coupon redemption must be claimed once, and stock must be decremented as part of the same checkout transaction. Keeping writes on a single primary preserves transaction correctness while isolating the write path from read-heavy traffic.

### PostgreSQL Read Replica(s)

Added because Part A Bug 5 showed order history expanding into `1+N+M` database queries, which is a read-heavy pattern that should not compete with checkout writes. Routing product list reads and order-history reads to replicas keeps the primary available for transactions during peak sale traffic and lowers the chance that read spikes slow down checkout.
