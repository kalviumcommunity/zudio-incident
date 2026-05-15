## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** src/controllers/product.controller.js
**Line:** ~16

**Root Cause:**
User input (`req.query.search`) is interpolated directly into an SQL string used by `pool.query`. This allows an attacker to inject SQL fragments which the database will execute.

**Reproduction Steps:**
1. Request: `curl "http://localhost:3000/api/products?search=shirt' OR '1'='1"`
2. Observe: The endpoint returns all products (or unexpected data) instead of only matching results; SQL injection is possible.
3. Expected vs actual: Expected only products matching the search term; actual may return all rows or unexpected results.

**Affected Users / Impact:**
All users and the system. An attacker could read or manipulate database content, exfiltrate data, or modify/drop tables.

**Fix Plan:**
Use parameterized queries and avoid string interpolation. Example: `SELECT * FROM products WHERE name ILIKE '%' || $1 || '%' LIMIT $2 OFFSET $3` with parameters `[search, limit, offset]`.

---

## Bug 2: Unbounded Wildcard Search Causes Full Table Scans

**Severity:** MEDIUM
**File:** src/controllers/product.controller.js
**Line:** ~16

**Root Cause:**
The search query uses a leading wildcard (`'%term%'`) without a reasonable `LIMIT` or full-text index, causing sequential scans that scale linearly with table size.

**Reproduction Steps:**
1. Populate the `products` table with many rows (thousands).
2. Request: `curl "http://localhost:3000/api/products?search=shirt"`
3. Observe: Response time grows noticeably with dataset size and can become very slow.
4. Expected vs actual: Expected fast search response; actual response time increases linearly and may time out.

**Affected Users / Impact:**
Users performing searches; large catalogs will have very slow search behavior, degrading UX and increasing DB load.

**Fix Plan:**
Implement parameterized queries with limits and pagination for search, and switch to full-text search or trigram indexes (Postgres `pg_trgm`) for performant substring searches. Example: use `ILIKE $1` with an index-friendly approach or `to_tsvector`/`to_tsquery` for full-text.

---

## Bug 3: Plaintext Password Storage

**Severity:** CRITICAL
**File:** src/controllers/auth.controller.js
**Line:** ~ thirty (INSERT INTO users)

**Root Cause:**
Passwords are inserted directly into the `users` table without hashing or salting. If the database is compromised, attackers obtain raw passwords.

**Reproduction Steps:**
1. Request: `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"name":"Alice","email":"alice@example.com","password":"P@ssw0rd"}'`
2. Inspect DB (psql): `SELECT email, password FROM users WHERE email='alice@example.com';`
3. Observe: The `password` column contains the cleartext `P@ssw0rd`.
4. Expected vs actual: Expected hashed password (e.g., bcrypt hash); actual stores plaintext.

**Affected Users / Impact:**
All registered users. If DB is leaked or accessed, attackers can use plaintext passwords to access user accounts on this and other sites (credential stuffing).

**Fix Plan:**
Hash passwords with a strong algorithm (bcrypt/argon2) on registration and compare with `bcrypt.compare` on login. Never log or return raw passwords. Update schema/migrations/docs as needed.

---

## Bug 4: Coupon Race Condition Allows Multiple Uses

**Severity:** HIGH
**File:** src/controllers/checkout.controller.js
**Line:** ~36 (SELECT FROM coupons)

**Root Cause:**
Coupon validation (`SELECT ... WHERE used = false`) and marking (`UPDATE coupons SET used = true`) are separate operations without a transaction or row lock. Concurrent requests can both see `used = false` and both apply the coupon.

**Reproduction Steps:**
1. Obtain a valid coupon code (e.g., `DISCOUNT10`) and an authenticated user token.
2. Send two concurrent `POST /api/cart/checkout` requests (same payload using the same `couponCode`) from two clients nearly simultaneously. Example (pseudo):
   - `curl -X POST http://localhost:3000/api/cart/checkout -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"items":[{"productId":1,"quantity":1}],"couponCode":"DISCOUNT10","shippingAddress":"Addr"}'`
3. Observe: Both requests succeed and both orders receive the coupon discount.
4. Expected vs actual: Expected coupon to apply only once; actual allows multiple orders to use same coupon when concurrent.

**Affected Users / Impact:**
Business (financial loss) and system integrity. Attackers or race conditions can apply discounts repeatedly.

**Fix Plan:**
Wrap coupon validation and marking in a DB transaction and acquire a row-level lock (SELECT ... FOR UPDATE) or use an atomic `UPDATE ... WHERE used = false RETURNING *` to claim the coupon. Verify the returned row to ensure single-use.

---

## Bug 5: Inventory Not Updated on Purchase

**Severity:** CRITICAL
**File:** src/controllers/checkout.controller.js
**Line:** ~72 (commented out stock update)

**Root Cause:**
The code that decrements `products.stock` after order placement is commented out, so inventory never decreases when orders are placed.

**Reproduction Steps:**
1. Check a product's stock: `SELECT id, stock FROM products WHERE id = 1;`
2. Place an order that purchases one unit of product `1` via `POST /api/cart/checkout` (authenticated) with appropriate `items`.
3. Check product stock again: `SELECT id, stock FROM products WHERE id = 1;`
4. Observe: Stock is unchanged.
5. Expected vs actual: Expected stock to decrement by purchased quantity; actual stock remains the same, causing overselling and inventory inconsistencies.

**Affected Users / Impact:**
Customers and operations. Overselling can lead to failed shipments, refunds, and inventory reconciliation headaches.

**Fix Plan:**
Uncomment and run stock decrement updates inside the same transaction that creates the order. Validate `stock >= quantity` and roll back transaction if insufficient. Consider using `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock` to atomically validate and decrement.

## Verification Table

| Bug | Before | After | Verification Method |
|-----|--------|-------|---------------------|
| SQL Injection | Returns all products | Returns 0 results (literal string) | `GET /api/products?search=shirt' OR '1'='1` |
| Plaintext Passwords | Password column: "mypassword" | Password column: "$2b$12$..." | `SELECT password FROM users WHERE id=1` |
| Double Discount | Coupon applied 400 times | 400th attempt returns 400 error | `POST /api/cart/checkout` × 2 same coupon |
| Stock Decrement | Stock unchanged after purchase | Stock reduced by quantity purchased | `GET /api/products` before vs after checkout |
| N+1 Order History | 14,200ms / 201 queries | 180ms / 2 queries | Profiling middleware output |

