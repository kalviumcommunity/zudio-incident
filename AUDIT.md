# Zudio Incident - Production Refactor Audit Report

This document contains the profiling results, production bugs identified, fixes implemented, and verification steps performed during the Zudio backend incident refactor.

## Developer
VDS MUKESH

---

# Profiling Table

| Endpoint | Response Time (Before) | Response Time (After) | Query Count (Before) | Query Count (After) | Notes |
|---|---|---|---|---|---|
| GET /api/products | ~300ms | ~50ms | 1 | 1 | Optimized search query |
| GET /api/products?search= | Vulnerable | Secure | 1 | 1 | SQL Injection fixed |
| POST /api/auth/register | ~45ms | ~90ms | 1 | 1 | bcrypt hashing added |
| POST /api/auth/login | ~20ms | ~60ms | 1 | 1 | bcrypt.compare added |
| GET /api/orders/history | ~14s | <500ms | 200+ | 1 | N+1 query removed |
| POST /api/cart/checkout | ~900ms | ~70ms | Multiple | ~6 | Transaction-safe checkout |

---

# Bug 1 — SQL Injection Vulnerability

## File
src/controllers/product.controller.js

## Root Cause
User-controlled input was directly concatenated into SQL query strings using template literals.

## Vulnerable Code

```js
const query = `SELECT * FROM products WHERE name LIKE '%${req.query.search}%'`
````

## Reproduction Steps

1. Send request:

```http
GET /api/products?search=shirt' OR '1'='1
```

2. The SQL query becomes unsafe because raw user input is injected directly into the SQL statement.

## Impact

Attackers could manipulate SQL queries to:

* bypass filters
* dump database contents
* extract sensitive data
* modify database records

This is a severe OWASP Top 10 vulnerability.

## Fix Applied

Replaced raw SQL string concatenation with parameterized PostgreSQL query placeholders.

## Fixed Code

```js
const query = `
  SELECT * FROM products
  WHERE name ILIKE $1
`

result = await pool.query(query, [`%${search}%`])
```

## Verification

Request tested again:

```http
GET /api/products?search=shirt' OR '1'='1
```

Result:

* No SQL injection possible
* Input treated as literal string
* Query executed safely

---

# Bug 2 — Plaintext Password Storage

## File

src/controllers/auth.controller.js

## Root Cause

Passwords were stored directly in the database without hashing or encryption.

## Vulnerable Code

```js
[name, email, password, phone || null]
```

and

```js
if (user.password !== password)
```

## Reproduction Steps

1. Register a new user.
2. Query database directly:

```sql
SELECT email, password FROM users;
```

3. Passwords appeared as plaintext.

Example:

```text
123456
```

## Impact

If the database is compromised:

* all user passwords become immediately exposed
* credential reuse attacks become possible
* user accounts become vulnerable

## Fix Applied

Implemented bcrypt password hashing during registration and bcrypt.compare during login verification.

## Fixed Code

```js
const hashedPassword = await bcrypt.hash(password, 10)
```

and

```js
const isMatch = await bcrypt.compare(password, user.password)
```

## Verification

Database query after fix:

```sql
SELECT email, password FROM users;
```

Result:

```text
$2b$10$...
```

Passwords are now securely hashed.

---

# Bug 3 — Coupon Applied Multiple Times

## File

src/controllers/checkout.controller.js

## Root Cause

Coupon validation and coupon update were performed as separate operations.

This allowed race conditions where multiple simultaneous requests could use the same coupon before it was marked as used.

## Vulnerable Flow

```js
SELECT coupon
THEN
UPDATE used=true
```

## Reproduction Steps

1. Send checkout request using coupon.
2. Quickly repeat the same request.
3. Coupon could be reused multiple times.

## Impact

* Duplicate discounts
* Revenue loss
* Incorrect order totals
* Potential negative pricing

## Fix Applied

Implemented atomic coupon update using a single UPDATE query with validation conditions.

## Fixed Code

```sql
UPDATE coupons
SET used = true
WHERE code = $1
AND used = false
AND expires_at > NOW()
RETURNING *
```

## Verification

Second coupon usage now returns:

```json
{
  "error": "Invalid or already used coupon"
}
```

---

# Bug 4 — Stock Never Decrements After Purchase

## File

src/controllers/checkout.controller.js

## Root Cause

The stock update logic was commented out and never executed.

## Vulnerable Code

```js
// for (const item of cartItems) {
//   await pool.query(
//     'UPDATE products SET stock = stock - $1 WHERE id = $2',
//     [item.quantity, item.productId]
//   )
// }
```

## Reproduction Steps

1. Check product stock using:

```http
GET /api/products
```

2. Complete checkout.
3. Check products again.
4. Stock remained unchanged.

## Impact

* Unlimited overselling
* Incorrect inventory
* Failed stock management
* Major production risk during sales

## Fix Applied

Re-enabled stock decrement logic and moved checkout flow into a database transaction.

Added stock validation during updates.

## Fixed Code

```sql
UPDATE products
SET stock = stock - $1
WHERE id = $2
AND stock >= $1
RETURNING id
```

## Verification

Before checkout:

```text
stock = 69
```

After checkout:

```text
stock = 67
```

Stock updates correctly after purchases.

---

# Bug 5 — Missing Transaction Safety

## File

src/controllers/checkout.controller.js

## Root Cause

Checkout operations were executed independently without database transactions.

Partial failures could corrupt data consistency.

## Problem Scenario

* order created successfully
* stock update fails
* coupon update fails

Database becomes inconsistent.

## Impact

* Corrupted order data
* Inventory mismatch
* Broken checkout state
* Financial inconsistencies

## Fix Applied

Implemented PostgreSQL transaction handling using:

* BEGIN
* COMMIT
* ROLLBACK

and dedicated client connections.

## Fixed Code

```js
const client = await pool.connect()

await client.query('BEGIN')

...

await client.query('COMMIT')
```

Rollback added for all failures.

## Verification

Simulated failures now rollback entire checkout operation safely.

---

# Bug 6 — N+1 Query Performance Problem

## File

src/controllers/order.controller.js

## Root Cause

Separate database queries were executed inside nested loops for every order and every product.

## Vulnerable Code

```js
for (const order of orders) {
  await pool.query(...)
}
```

and

```js
for (const item of itemsResult.rows) {
  await pool.query(...)
}
```

## Reproduction Steps

1. Request:

```http
GET /api/orders/history
```

2. Observe terminal query logs.
3. Hundreds of queries executed.

## Impact

* Extremely slow responses
* High database load
* Poor scalability
* API response time reached ~14 seconds

## Fix Applied

Replaced nested queries with optimized JOIN query.

Grouped results in memory after fetching.

## Fixed Query

```sql
SELECT
  o.id AS order_id,
  oi.id AS order_item_id,
  p.image_url
FROM orders o
LEFT JOIN order_items oi
  ON o.id = oi.order_id
LEFT JOIN products p
  ON oi.product_id = p.id
WHERE o.user_id = $1
```

## Verification

After optimization:

* Query count reduced to 1
* Response time reduced to under 500ms

---

# Security Improvements

## Added

* Parameterized SQL queries
* bcrypt password hashing
* Transaction safety
* Atomic coupon updates
* Stock validation
* Rollback protection

---

# Performance Improvements

## Added

* Query profiling middleware
* Response timing middleware
* JOIN-based query optimization
* Query count tracking

---

# Verification Checklist

| Test                      | Status |
| ------------------------- | ------ |
| SQL Injection blocked     | ✅      |
| Password hashing working  | ✅      |
| Secure login working      | ✅      |
| Coupon reuse blocked      | ✅      |
| Stock decrement working   | ✅      |
| Rollback handling working | ✅      |
| Order history optimized   | ✅      |
| Query profiling enabled   | ✅      |
| Response timing enabled   | ✅      |

---

# Final Result

The Zudio backend was successfully refactored and stabilized by:

* fixing critical security vulnerabilities
* preventing inventory corruption
* implementing transaction safety
* optimizing database performance
* reducing query load
* improving production reliability

The backend is now significantly safer, faster, and more production-ready.
