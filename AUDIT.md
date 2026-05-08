# Bug Audit

## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** src/controllers/product.controller.js
**Line:** 14

**Root Cause:**
The `search` query parameter is concatenated directly into a SQL string, so PostgreSQL receives attacker-controlled SQL instead of data-bound parameters.

**Reproduction Steps:**
1. Send `GET /api/products?search=shirt%27%20OR%20%271%27%3D%271` with `curl` or Postman.
2. Observe that the endpoint still executes the raw interpolated query branch.
3. Expected: parameterized search that treats input as plain text. Actual: raw SQL string construction that can be extended into arbitrary SQL.

**Affected Users / Impact:**
Any user searching products can trigger a database read/manipulation vulnerability. A crafted payload could expose or modify data across the catalog.

**Fix Plan:**
Replace string interpolation with a parameterized `ILIKE` or `LIKE` query and bind the search term as a value.

## Bug 2: Plaintext Password Storage

**Severity:** CRITICAL
**File:** src/controllers/auth.controller.js
**Line:** 20

**Root Cause:**
Registration stores the submitted password exactly as received. If the database is dumped, queried directly, or accessed by an operator, every password is immediately readable.

**Reproduction Steps:**
1. Send `POST /api/auth/register` with `{ "email": "audit@example.com", "password": "Password123!", "name": "Audit User" }`.
2. Observe registration succeeds.
3. Query the `users.password` column directly in PostgreSQL and compare the value. Expected: hashed password. Actual: plaintext password.

**Affected Users / Impact:**
All registered users are exposed if the DB is accessed directly. This is a full credential disclosure issue and can lead to account takeover on other sites where users reuse passwords.

**Fix Plan:**
Hash passwords before insert with a strong password hashing algorithm such as bcrypt and compare hashes during login.

## Bug 3: Coupon Redemption Race Condition

**Severity:** HIGH
**File:** src/controllers/checkout.controller.js
**Line:** 27

**Root Cause:**
Coupon validation and coupon redemption are split into separate queries with no transaction or row lock. Concurrent checkouts can both observe `used = false` before either request marks the coupon as used.

**Reproduction Steps:**
1. Fire two identical `POST /api/cart/checkout` requests at the same time with the same valid `couponCode` such as `ZUDIO100`.
2. Observe that both requests can pass the coupon validation window under concurrency.
3. Expected: exactly one successful redemption. Actual: the discount can be applied more than once when requests overlap.

**Affected Users / Impact:**
This can double-discount or multi-discount the same coupon under load, directly causing revenue loss and inconsistent order state.

**Fix Plan:**
Redeem the coupon inside a transaction and claim it atomically, for example with a conditional `UPDATE ... WHERE used = false` or row locking.

## Bug 4: Inventory Never Decrements

**Severity:** CRITICAL
**File:** src/controllers/checkout.controller.js
**Line:** 55

**Root Cause:**
The stock update loop is commented out, so successful orders never reduce product inventory. Every checkout leaves the same stock value in the database.

**Reproduction Steps:**
1. Send a valid `POST /api/cart/checkout` with a real product and bearer token.
2. Call `GET /api/products` before and after checkout.
3. Expected: product stock decreases by the purchased quantity. Actual: stock stays unchanged.

**Affected Users / Impact:**
All purchase flows are affected. Inventory becomes inaccurate immediately, overselling products and breaking downstream fulfillment and reporting.

**Fix Plan:**
Re-enable the stock update inside the checkout flow and make it part of the same transaction as order creation so inventory, orders, and coupon usage stay consistent.

## Bug 5: N+1 Queries in Order History

**Severity:** MEDIUM
**File:** src/controllers/order.controller.js
**Line:** 19

**Root Cause:**
The history endpoint fetches each order, then each order item, then each product individually. That creates one query per item, so latency grows linearly with history size.

**Reproduction Steps:**
1. Log in as a seeded user with many orders, for example `aarav.sharma@example.com`.
2. Send `GET /api/orders/history` with the returned JWT.
3. Expected: a small, bounded number of queries. Actual: the request took about `8.5s` and logged `106` queries for one seeded account.

**Affected Users / Impact:**
Users with meaningful order histories will see slow, increasingly unusable account pages. The endpoint gets more expensive as the dataset grows.

**Fix Plan:**
Load orders, items, and products with joins or batched lookups so the endpoint runs in a constant or near-constant number of queries.

---

## Fix Implementation Summary

### Round 1: Security Fixes (Commit b4827fc)
✅ **SQL Injection in Product Search** - Parameterized query with `ILIKE $1` binding
✅ **Plaintext Passwords** - bcrypt.hash() on register, bcrypt.compare() on login  
✅ **Verification:** All seed data regenerated with bcrypt hashes

### Round 2: Logic Fixes (Commit abab682)
✅ **Coupon Race Condition** - Atomic `UPDATE coupons SET used = true WHERE ... RETURNING *` in transaction
✅ **Stock Never Decrements** - Re-enabled stock update with `AND stock >= quantity` guard in checkout transaction
✅ **Verification:** Coupon reuse rejected, stock confirmed decreasing post-purchase

### Round 3: Performance Fixes (Commit pending)
✅ **N+1 Query in Order History** - Replaced loop with single JOIN query combining orders, order_items, and products

**Performance Metrics (Aarav Sharma - 9 orders):**
- **Before:** 106 queries, ~8.5 seconds latency
- **After:** 1 query, ~175ms latency
- **Improvement:** 99.06% query reduction, 98% latency reduction

**Schema Optimizations:**
- Added `CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC)`
- Added `CREATE INDEX idx_order_items_order_id ON order_items(order_id)`