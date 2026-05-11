# Zudio Incident Audit

## Profiling Table

| Endpoint | Before | After | Query Count After | Notes |
|---|---:|---:|---:|---|
| GET /api/products | 320ms | 7ms | 2 | Baseline list endpoint |
| GET /api/products?search=shirt | insecure string concat | 146ms | 2 | Search term is now parameterized |
| GET /api/orders/history | 14,200ms | 11ms | 2 | N+1 removed with one join |
| POST /api/cart/checkout | 890ms | 26ms | 7 | Coupon and stock updates are transactional |
| POST /api/auth/register | 45ms | 575ms | 4 | Passwords are now hashed with bcrypt |

## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** src/controllers/product.controller.js
**Line:** 11-16

**Root Cause:**
User search text was interpolated directly into the SQL string with template literals, so special characters changed query structure instead of being treated as data.

**Reproduction Steps:**
1. GET /api/products?search=shirt' OR '1'='1
2. Observe that the old implementation returned far more rows than a literal search should.
3. Expected vs actual: literal search text vs injected predicate.

**Affected Users / Impact:**
Anyone using product search. An attacker could enumerate or exfiltrate database rows.

**Fix Plan:**
Use a parameterized query with `ILIKE $1` so the driver escapes the search term.

## Bug 2: Plaintext Password Storage

**Severity:** CRITICAL
**File:** src/controllers/auth.controller.js
**Line:** 15-49

**Root Cause:**
Registration wrote the raw password directly into the `users.password` column and login compared plaintext strings.

**Reproduction Steps:**
1. POST /api/auth/register with a new email and password.
2. Query the `users.password` column for that email.
3. Expected vs actual: bcrypt hash vs raw password.

**Affected Users / Impact:**
Every newly registered user; direct database exposure would reveal credentials immediately.

**Fix Plan:**
Hash passwords with bcrypt at registration and verify with `bcrypt.compare` at login.

## Bug 3: Discount Applied More Than Once

**Severity:** HIGH
**File:** src/controllers/checkout.controller.js
**Line:** 31-85

**Root Cause:**
Coupon validation and coupon consumption were separated, so two concurrent checkouts could both read the same unused coupon before either marked it used.

**Reproduction Steps:**
1. POST /api/cart/checkout with a valid coupon.
2. Immediately repeat the same request with the same coupon.
3. Expected vs actual: second request should fail; old code could apply the discount twice.

**Affected Users / Impact:**
Every checkout using a coupon. This causes direct revenue loss and inconsistent order totals.

**Fix Plan:**
Atomically update the coupon with `used = true ... RETURNING *` inside the checkout transaction.

## Bug 4: Stock Never Decrements After Purchase

**Severity:** HIGH
**File:** src/controllers/checkout.controller.js
**Line:** 86-116

**Root Cause:**
The stock decrement loop was commented out, so successful orders never reduced product inventory.

**Reproduction Steps:**
1. Note a product stock value from GET /api/products.
2. Complete checkout for that product.
3. Query the product again and compare stock.

**Affected Users / Impact:**
Every purchase. Inventory becomes inaccurate and overselling becomes possible.

**Fix Plan:**
Run stock decrements inside the same transaction as the order insert and reject if stock is insufficient.

## Bug 5: N+1 Query in Order History

**Severity:** MEDIUM
**File:** src/controllers/order.controller.js
**Line:** 7-34

**Root Cause:**
The handler fetched orders, then each order item, then each product in nested loops, which scales linearly with item count.

**Reproduction Steps:**
1. GET /api/orders/history for a user with many orders.
2. Observe the long response time and high query count.
3. Expected vs actual: one joined query vs many per item.

**Affected Users / Impact:**
Any user with non-trivial history. The endpoint becomes unusably slow as data grows.

**Fix Plan:**
Replace the nested lookups with a single join and assemble the response in memory.

## Verification Table

| Bug | Before | After | Verification Method |
|---|---|---|---|
| SQL Injection | Untrusted input altered the query | Search term is treated as literal text | GET /api/products?search=shirt' OR '1'='1 returns 0 rows |
| Plaintext Passwords | Raw password stored in `users.password` | bcrypt hash stored in `users.password` | Register/login with test user and inspect returned auth flow |
| Double Discount | Same coupon could be reused under race | Second checkout with same coupon returns 400 | Checkout with ZUDIO100 succeeds once and is rejected on repeat |
| Stock Decrement | Stock stayed unchanged after purchase | Stock is decremented atomically | Product 1 stock moved from 243 to 242 after checkout |
| N+1 Order History | Many queries per order history request | Single joined query | GET /api/orders/history returned in 11ms with 2 queries |