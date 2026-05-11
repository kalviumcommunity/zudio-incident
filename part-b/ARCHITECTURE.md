# Current Architecture

## Existing Monolith Architecture

Internet
    │
    ▼
┌──────────────────────────────────────┐
│ Single Node.js Express Server        │
│                                      │
│ - Routes + Controllers + DB Logic    │
│ - No caching layer                   │
│ - No clustering                      │
│ - No connection pooling              │
│ - Synchronous DB queries             │
│                                      │
│ ⚠️ Part A Finding: N+1 queries caused │
│    14s order history response        │
│                                      │
│ ⚠️ Part A Finding: Single server      │
│    crashed under concurrent load     │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│ Single PostgreSQL Database           │
│                                      │
│ - Reads + Writes on same DB          │
│ - No foreign key indexes             │
│ - No read replicas                   │
│ - No NOT NULL constraints            │
│                                      │
│ ⚠️ Full table scans during joins     │
│ ⚠️ DB bottleneck during product load │
└──────────────────────────────────────┘

---

# Scaled Architecture for 1 Lakh Users

Internet Users
        │
        ▼
┌──────────────────────────────┐
│ CDN (CloudFront / Nginx)     │
│ Static asset caching         │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│ Load Balancer (Nginx)        │
│ SSL + Rate Limiting          │
│ Health Checks                │
└──────────────────────────────┘
     │         │         │
     ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Node 1  │ │Node 2  │ │Node 3  │
│Express │ │Express │ │Express │
└────────┘ └────────┘ └────────┘
      │        │        │
      └────────┴────────┘
               │
               ▼
┌──────────────────────────────┐
│ Redis Cluster                │
│ - Product Cache              │
│ - Coupon Locking             │
│ - JWT Blacklist              │
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│ PostgreSQL Primary           │
│ Writes + Transactions        │
└──────────────────────────────┘
        │
        ├──────────────┐
        ▼              ▼
┌──────────────┐ ┌──────────────┐
│ Read Replica │ │ Read Replica │
│ Product Read │ │ Order Read   │
└──────────────┘ └──────────────┘

---

# Architecture Decisions

## Redis Cache

Redis was added because Part A profiling showed GET /api/products
hitting PostgreSQL on every request. Product data changes rarely,
so Redis reduces repeated DB queries and improves response time
from ~300ms to under 10ms.

## Load Balancer

Part A revealed that a single Node.js process became unstable
under concurrent traffic. Nginx distributes traffic across
multiple stateless Node.js instances to avoid single-point failure.

## Read Replicas

Read-heavy queries like order history and product listing are
moved to replicas. This prevents checkout transactions on the
primary database from slowing down customer browsing.

## CDN

Static product images previously came directly from Node.js.
Serving them through a CDN reduces bandwidth usage and API load.