# Current Architecture

Internet
    │
    ▼
┌─────────────────────────────────┐
│  Single Node.js Express Server  │
│                                 │
│ ⚠️ SPOF: One crash = full outage |
│ ⚠️ Part A Bug 5: N+1 queries     |
│ ⚠️ No caching layer              |
│ ⚠️ All logic in one process      |
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Single PostgreSQL Instance     │
│                                 │
│ ⚠️ Reads + writes on same DB    |
│ ⚠️ No read replicas             |
│ ⚠️ High DB load during traffic  |
└─────────────────────────────────┘

---

# Problems Identified from Part A

- SQL injection vulnerability in product search
- Plaintext password storage
- Coupon race condition
- Inventory stock inconsistency
- N+1 query issue in order history
- High database dependency
- No caching
- Single server bottleneck

# Proposed Architecture for 1 Lakh Users

Internet Users
       │
       ▼
┌───────────────────────┐
│         CDN           │
│ Product Images Cache  │
└───────────────────────┘
       │
       ▼
┌───────────────────────┐
│     Load Balancer     │
│ Traffic Distribution  │
└───────────────────────┘
       │
 ┌─────┼─────┐
 ▼     ▼     ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Node App │ │ Node App │ │ Node App │
│ Instance │ │ Instance │ │ Instance │
└──────────┘ └──────────┘ └──────────┘
       │
       ▼
┌────────────────────────────┐
│       Redis Cluster        │
│ Product Cache + Coupon Lock│
└────────────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ PostgreSQL Primary DB      │
│ Writes + Transactions      │
└────────────────────────────┘
       │
 ┌─────┴─────┐
 ▼           ▼
┌──────────┐ ┌──────────┐
│ Read DB  │ │ Read DB  │
│ Replica  │ │ Replica  │
└──────────┘ └──────────┘

---

## CDN

Added because product images and static assets should not hit the backend server directly.
This reduces server bandwidth usage and improves loading speed globally.

## Load Balancer

Added because a single Node.js server becomes a bottleneck during heavy traffic.
Traffic is distributed across multiple backend instances.

## Multiple Stateless Node.js Instances

Added to horizontally scale the application.
If one server crashes, other instances continue handling traffic.

## Redis Cache

Added because Part A profiling showed repeated product queries hitting PostgreSQL every request.
Redis stores product responses in memory and reduces database load significantly.

## PostgreSQL Read Replicas

Added because Part A identified read-heavy operations like order history queries.
Read replicas separate read traffic from write traffic and improve scalability.

## PostgreSQL Primary

Handles transactions, stock updates, coupon usage, and checkout operations safely.
Critical writes remain centralized for consistency.