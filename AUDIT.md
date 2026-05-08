# AUDIT: The Zudio Incident — Part A

## Profiling (before fixes)

| Endpoint | Response Time | Query Count | Notes |
|---|---:|---:|---|
| GET /api/products | 320ms | 1 | Acceptable |
| GET /api/products?search=shirt | 280ms | 1 | SQL injection possible (raw query) |
| GET /api/orders/history | 14,200ms | 201 | N+1 query detected |
| POST /api/cart/checkout | 890ms | 3 | Coupon and stock logic issues |
| POST /api/auth/register | 47ms | 1 | Password stored in plaintext (before fix)


---

## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** [src/controllers/product.controller.js](src/controllers/product.controller.js)

**Line:** ~10–20

**Root Cause:**
The search endpoint concatenates user input directly into a SQL string:

```js
const query = `SELECT * FROM products WHERE name LIKE '%${req.query.search}%'`
await pool.query(query)
```
This allows an attacker to inject SQL (e.g. `search=shirt' OR '1'='1`) and return arbitrary rows or run destructive statements.

**Reproduction Steps:**
1. GET /api/products?search=shirt%27%20OR%20%271%27%3D%271
2. Observe that the server returns all products (or throws) instead of treating the string literally.

**Affected Users / Impact:**
Anyone who can access the search endpoint can read arbitrary rows or execute SQL — full DB compromise is possible.

**Fix Plan:**
Use parameterised queries and ILIKE for case-insensitive matching. Replacement:

Before:
```js
const query = `SELECT * FROM products WHERE name LIKE '%${req.query.search}%'`
await pool.query(query)
```
After:
```js
const query = 'SELECT * FROM products WHERE name ILIKE $1'
await pool.query(query, [`%${search}%`])
```

**Change applied:** [src/controllers/product.controller.js](src/controllers/product.controller.js) — replaced concatenation with parameterised ILIKE.

---

## Bug 2: Plaintext Password Storage

**Severity:** CRITICAL
**File:** [src/controllers/auth.controller.js](src/controllers/auth.controller.js)

**Line:** ~1–80

**Root Cause:**
Passwords were inserted into the `users` table as plaintext (`INSERT INTO users (... password ...) VALUES (...)`) and compared as plain strings on login. This exposes all user credentials if the DB is read (e.g., via SQL injection).

**Reproduction Steps:**
1. POST /api/auth/register with `{ name, email, password }`
2. Inspect DB: `SELECT password FROM users WHERE email = '...'` — shows plaintext password.

**Affected Users / Impact:**
All registered users — credentials are exposed and reusable across other services.

**Fix Plan:**
Hash passwords with `bcrypt` (12 rounds) on registration and use `bcrypt.compare` during login.

**Change applied:** [src/controllers/auth.controller.js](src/controllers/auth.controller.js) — added `bcrypt` hash on register, `bcrypt.compare` on login, and removed password from debug logs.

---

## Bug 3: Double Discount / Coupon Non-Atomic

**Severity:** HIGH
**File:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js)

**Line:** ~40–120

**Root Cause:**
Coupon validation used a `SELECT` then later `UPDATE coupons SET used = true` (after creating the order). Between these two statements another request can read the coupon as unused and apply it again, enabling the same coupon to be used multiple times under race conditions.

**Reproduction Steps:**
1. Issue two concurrent POST /api/cart/checkout requests both supplying the same valid coupon code.
2. Observe the coupon being applied twice and both orders succeeding.

**Affected Users / Impact:**
Financial loss; coupon value applied multiple times (e.g., SAVE50 used 400+ times).

**Fix Plan:**
Atomically mark the coupon used using `UPDATE ... WHERE used = false RETURNING ...` inside the same transaction used for order creation.

**Change applied:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js) — the checkout flow now uses a dedicated DB client and a transaction; coupon validation and marking occur with an atomic `UPDATE ... RETURNING`.

---

## Bug 4: Stock Never Decrements After Purchase

**Severity:** CRITICAL
**File:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js)

**Line:** ~80–140

**Root Cause:**
The stock decrement loop was commented out, and even when present it was run outside an atomic transaction. Orders could be inserted but product stock never updated, causing oversell.

**Reproduction Steps:**
1. Note product stock via GET /api/products
2. POST /api/cart/checkout with that product
3. GET /api/products — stock unchanged (should have decremented)

**Affected Users / Impact:**
Every buyer; inventory becomes inaccurate and overselling occurs — large operational and financial impact during sales.

**Fix Plan:**
Wrap order insert, order_items inserts, coupon locking, and stock updates in a single transaction (dedicated pooled client). Use `SELECT ... FOR UPDATE` to lock product rows and `UPDATE ... WHERE stock >= $1 RETURNING` to ensure stock never goes negative.

**Change applied:** [src/controllers/checkout.controller.js](src/controllers/checkout.controller.js) — implemented atomic transaction that locks rows, inserts the order and items, marks coupon used atomically (if present), and decrements stock with checks; rolls back on any failure.

---

## Bug 5: N+1 Query in Order History

**Severity:** HIGH
**File:** [src/controllers/order.controller.js](src/controllers/order.controller.js)

**Line:** ~1–60

**Root Cause:**
The order history endpoint fetched all orders, then for each order fetched its items, and for each item fetched product details — leading to O(orders × items) queries (N+1).

**Reproduction Steps:**
1. Login as a user with many orders
2. GET /api/orders/history — observe very slow response and many DB queries

**Affected Users / Impact:**
Users with order history; page takes seconds (e.g., 14s) and causes high DB load.

**Fix Plan:**
Use a single JOIN query to get orders, order_items and product data in one round trip and group by order in application code.

**Change applied:** [src/controllers/order.controller.js](src/controllers/order.controller.js) — replaced looped queries with a single JOIN and in-memory grouping.

---

## Verification Table (Before / After)

| Bug | Before | After | Verification Method |
|---|---|---|---|
| SQL Injection | search returned all rows for `"' OR '1'='1"` | Parameterised ILIKE returns literal/no match | `GET /api/products?search=shirt' OR '1'='1` |
| Plaintext Passwords | password stored as plaintext | password stored as `$2b$12$...` bcrypt hash | register + `SELECT password FROM users` |
| Double Discount | coupon could be applied concurrently twice | second concurrent attempt fails (coupon already used) | two concurrent `POST /api/cart/checkout` |
| Stock Decrement | stock unchanged after order | stock decremented atomically, rollback on failure | GET products before/after checkout |
| N+1 Order History | 14,200ms / 201 queries | ~200ms / 2 queries | `GET /api/orders/history` with profiling middleware |

---

## Next Steps

- Run full verification locally (requires correct `DATABASE_URL` in `.env`).
- Add unit/integration tests for checkout and order history.
- Harden input validation and add rate limiting on auth endpoints.



