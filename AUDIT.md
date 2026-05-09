# Part A — Audit & Fixes

This audit documents the five planted issues from the incident brief, the code paths that control them, the fixes now present in the repo, and the verification steps that should be run locally before submission.

## Profile Table

| Endpoint | Response Time | Query Count | Observation |
|---|---:|---:|---|
| GET /api/products | ~200ms | 1 | Paginated product list |
| GET /api/products?search=shirt | ~220ms | 1 | Parameterised search |
| GET /api/products?search=shirt' OR '1'='1 | ~220ms | 1 | Treated as literal text, not SQL |
| GET /api/orders/history | ~400ms | 1 | Single joined query, no N+1 |
| POST /api/cart/checkout | ~700ms | ~6 | Transactional checkout path |
| POST /api/auth/register | ~60ms | 1 | Password is hashed before insert |

These numbers are the expected baseline for the current code path and should be confirmed by running the server locally with the profiling middleware enabled.

## Bugs Found And Fixed

### Bug 1: Plaintext Password Storage

**Severity:** CRITICAL
**File:** [src/controllers/auth.controller.js](src/controllers/auth.controller.js#L1)
**Line:** around 5, 20, 52

**Root Cause:**
The register flow originally wrote the user’s raw password directly into the database, and login compared the submitted password with a plain string. That means any DB exposure would reveal usable credentials immediately.

**Reproduction Steps:**
1. Register a user through `POST /api/auth/register`.
2. Query the database with `SELECT password FROM users WHERE email = 'test@example.com';`.
3. Observe whether the stored value is plaintext or a bcrypt hash.

**Affected Users / Impact:**
Every registered user. A direct database leak would expose all passwords in clear text, and password reuse would let an attacker take over other services.

**Fix:**
Passwords are now hashed with bcrypt before insertion, and login uses `bcrypt.compare`. The hashing cost is set to 12 rounds in the controller. The seed generator also emits bcrypt-compatible hashes so seeded data matches runtime auth.

---

### Bug 2: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** [src/controllers/product.controller.js](src/controllers/product.controller.js#L1)
**Line:** around 12 to 17 in the original buggy version

**Root Cause:**
The search term was interpolated directly into a SQL string. That allowed attacker-controlled input to change the query structure instead of staying a literal value.

**Reproduction Steps:**
1. Send `GET /api/products?search=shirt' OR '1'='1`.
2. If vulnerable, the endpoint returns all products or unexpected rows.
3. Try a UNION-style payload to confirm the query is injectable.

**Affected Users / Impact:**
Any user who hits the search bar. This can expose the product table, the users table, or any readable data accessible through the database account.

**Fix:**
The search query now uses `ILIKE $1` with a parameterized `%${search}%` value. The database driver escapes the value, so payloads stay literal text.

---

### Bug 3: Double Discount / Coupon Reuse

**Severity:** HIGH
**File:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js#L1)
**Line:** around 52 to 80 in the current implementation, corresponding to the coupon path

**Root Cause:**
The coupon check and the “mark as used” step must be atomic. If those actions are separated or not locked, two concurrent checkout requests can both see the same coupon as unused and both apply it.

**Reproduction Steps:**
1. Start two checkout requests in parallel using the same coupon code.
2. Observe whether both requests get the discount.
3. The second request should fail with `400` once the coupon is consumed.

**Affected Users / Impact:**
All customers using promotional coupons. The business loses revenue whenever one coupon can be applied more than once.

**Fix:**
Checkout now runs inside a single transaction, locks the coupon row with `FOR UPDATE`, validates `used` and expiry, then updates the coupon as used before committing.

---

### Bug 4: Stock Never Decrements After Purchase

**Severity:** CRITICAL
**File:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js#L1)
**Line:** around 90 to 120 in the current implementation, corresponding to the stock update loop

**Root Cause:**
The purchase flow created the order, but the inventory update either did not execute or was not tied to the same transaction. That means orders could succeed while stock remained unchanged.

**Reproduction Steps:**
1. Note a product’s stock with `GET /api/products`.
2. Place a valid order for that product.
3. Query the product again and compare stock before and after.

**Affected Users / Impact:**
Every customer ordering inventory-managed products. Overselling becomes possible, inventory reports become unreliable, and manual correction is required.

**Fix:**
The checkout flow now decrements stock inside the same transaction as the order insert and coupon update. The update includes `AND stock >= $1` so the request fails instead of driving stock negative.

---

### Bug 5: N+1 Query in Order History

**Severity:** HIGH
**File:** [src/controllers/order.controller.js](src/controllers/order.controller.js#L1)
**Line:** around 5 to 40 in the original buggy version

**Root Cause:**
The history endpoint originally fetched orders, then fetched items per order, then fetched product details per item. That creates an N+1 pattern that scales linearly with data size and becomes slow very quickly.

**Reproduction Steps:**
1. Call `GET /api/orders/history` for a user with multiple orders and items.
2. Measure query count and response time.
3. If vulnerable, the request issues many round trips and takes seconds.

**Affected Users / Impact:**
Any user with a meaningful order history. The endpoint becomes unusable under normal growth and wastes database capacity.

**Fix:**
The endpoint now uses one joined query across orders, order_items, and products, then groups the rows in memory. That reduces the query count to one round trip for the full page.

## Verification Table

| Bug | Before | After | Verification Method |
|---|---|---|---|
| SQL Injection | Search query could be manipulated | Payload is treated as literal text | GET /api/products?search=shirt' OR '1'='1 |
| Plaintext Passwords | Password stored as raw text | Password stored as bcrypt hash | POST register, then query `users.password` |
| Double Discount | Same coupon could be reused | Second request returns `400` | Two rapid checkout requests with same coupon |
| Stock Decrement | Stock unchanged after purchase | Stock reduced by purchased quantity | Compare product stock before and after checkout |
| N+1 Order History | Many queries and slow response | Single query and faster response | Profile `GET /api/orders/history` |

## Files Updated

- [src/app.js](src/app.js#L1): request profiling middleware added.
- [src/db/index.js](src/db/index.js#L1): query counting wrapper added.
- [src/controllers/auth.controller.js](src/controllers/auth.controller.js#L1): bcrypt hashing and compare.
- [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js#L1): transaction-safe coupon and stock handling.
- [src/controllers/order.controller.js](src/controllers/order.controller.js#L1): single JOIN order history query.
- [src/controllers/product.controller.js](src/controllers/product.controller.js#L1): parameterised product search.
- [scripts/generate_seed.js](scripts/generate_seed.js#L1): bcrypt-hashed seed generation.

## Notes

The repository now reflects the intended Part A fixes. The remaining submission step is to run the app locally, capture the live profile numbers, and replace the expected timings above with the measured values from your own environment before you submit the PR.
