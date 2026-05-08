# API Audit Report

Date: 2026-05-08
Scope: Manual endpoint testing with curl before source review
Base URL: http://localhost:3000

## Findings

1. Endpoint: GET /api/products

- Status: Works
- Observation: Returned 20 products with expected fields (id, name, description, price, stock, category_name, etc.).

2. Endpoint: GET /api/products?search=shirt

- Status: Unexpected behavior
- Observation: Returned {"products":[],"count":0} even though multiple product names contain "Shirt".
- Risk: Search feature appears broken or overly restrictive.

3. Endpoint: GET /api/products?search=shirt' OR '1'='1

- Status: No obvious SQL injection via this payload
- Observation: After URL-encoding the payload, response was {"products":[],"count":0}.
- Note: Initial unencoded request failed at curl level due to malformed URL; encoded request reached the API.

4. Endpoint: POST /api/auth/register

- Payload: { email, password, name }
- Status: Works
- Observation: Registration successful; JWT and created user details were returned.

5. Endpoint: POST /api/auth/login

- Payload: { email, password }
- Status: Works
- Observation: Login successful; JWT and user details were returned.

6. Endpoint: GET /api/orders/history

- Auth: Bearer token from login
- Status: Works
- Observation: Returned {"orders":[]} for a newly created user (expected).

7. Endpoint: POST /api/cart/checkout (first valid attempt)

- Auth: Bearer token
- Payload used: {"items":[{"productId":1,"quantity":2}],"couponCode":"ZUDIO100","shippingAddress":"123 Main St, City"}
- Status: Works
- Observation: Order placed successfully and discount applied.

8. Endpoint: POST /api/cart/checkout (same coupon reused)

- Auth: Bearer token
- Payload used: Same as step 7
- Status: Works (validation enforced)
- Observation: Returned {"error":"Invalid or expired coupon"} on second use of ZUDIO100.

9. Endpoint: GET /api/products (after checkout)

- Status: Potential logic defect
- Observation: Product id 1 stock remained 243 after successful checkout of quantity 2.
- Risk: Inventory is not reduced after order placement, enabling overselling.

## Priority Summary

- High: Inventory is not decremented after checkout.
- Medium: Product search returns empty for common query "shirt" despite matching data.
- Low: No obvious SQL injection from tested payload; broader injection testing still recommended.

## Notes

- Checkout payload must use these exact keys: productId, couponCode, shippingAddress.
- Using product_id, coupon, or shipping_address produces validation errors and can create false negatives during testing.

## Profiling Results

| Endpoint                       | Response Time | Query Count | Observation                                                                                       |
| ------------------------------ | ------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| GET /api/products              | 169ms         | 1           | Single list query; response is noticeably slower than other endpoints due to larger payload size. |
| GET /api/products?search=shirt | 18ms          | 1           | Fast, but still returns empty result unexpectedly.                                                |
| GET /api/orders/history        | 15ms          | 1+N+M       | Query count scales with data: 1 order query + N item-list queries + M product detail queries.     |
| POST /api/cart/checkout        | 44ms          | 3           | For no-coupon, one-item payload path: product lookup + order insert + order_item insert.          |

Profiling source:

- Response times were captured from curl output using `%{time_total}`.
- Query counts were derived from the wrapped `pool.query` execution paths in the current controller logic.

## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL
**File:** src/controllers/product.controller.js
**Line:** 14

**Root Cause:**
The search branch builds SQL via string interpolation (`...LIKE '%${req.query.search}%'`) instead of a parameterized query. Untrusted input is treated as executable SQL.

**Reproduction Steps:**

1. Send: `curl -X GET "http://localhost:3000/api/products?search=shirt%27%20OR%20%271%27%3D%271"`
2. Observe SQL parser behavior and output changes when search payload includes operators/quotes.
3. Expected vs actual: Expected input to be treated as plain text search term; actual code executes user-supplied SQL syntax path.

**Affected Users / Impact:**
All users. Attackers can extract unintended data and potentially escalate to data manipulation depending on DB permissions.

**Fix Plan:**
Use a parameterized statement, e.g. `WHERE name ILIKE $1` with `[%${search}%]`. Add input validation and reject dangerous malformed payloads.

## Bug 2: Plaintext Password Storage

**Severity:** HIGH
**File:** src/controllers/auth.controller.js
**Line:** 25

**Root Cause:**
Registration inserts the raw `password` directly into the `users.password` column, and login compares plaintext strings. No one-way hashing is used.

**Reproduction Steps:**

1. Register: `curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"email":"leakcheck@example.com","password":"plain123","name":"Leak Check"}'`
2. Query DB directly: `SELECT email, password FROM users WHERE email='leakcheck@example.com';`
3. Expected vs actual: Expected stored value to be a bcrypt/argon hash; actual stored value is readable plaintext.

**Affected Users / Impact:**
All registered users. Any DB leak immediately exposes reusable credentials and causes account takeover risk across services.

**Fix Plan:**
Hash with bcrypt/argon2 on register, compare with secure hash verification on login, and force-reset existing plaintext-password accounts.

## Bug 3: Coupon Reuse Race Condition

**Severity:** CRITICAL
**File:** src/controllers/checkout.controller.js
**Line:** 45

**Root Cause:**
Coupon validity check (`used=false`) and coupon update (`used=true`) are separate queries without a transaction/row lock. Concurrent requests can both pass validation before either marks used.

**Reproduction Steps:**

1. Fire two checkout requests in parallel with the same valid coupon (example `ZUDIO100`) and same user/token.
2. Observe both requests can return success if they race before the update executes.
3. Expected vs actual: Expected only one request to redeem coupon; actual behavior can apply discount multiple times.

**Affected Users / Impact:**
Business revenue loss. Any high-traffic or scripted client can exploit concurrent submits to gain repeated discounts.

**Fix Plan:**
Wrap checkout in a DB transaction and atomically claim coupon (`UPDATE ... WHERE code=$1 AND used=false ... RETURNING *`) before order creation; rollback on failures.

## Bug 4: Inventory Never Decrements After Purchase

**Severity:** CRITICAL
**File:** src/controllers/checkout.controller.js
**Line:** 79

**Root Cause:**
The stock decrement block is commented out, so successful orders never reduce `products.stock`.

**Reproduction Steps:**

1. Capture stock for product 1 via `GET /api/products`.
2. Place successful checkout with product 1 quantity > 0.
3. Expected vs actual: Expected stock to decrease by quantity purchased; actual stock remains unchanged.

**Affected Users / Impact:**
All shoppers and operations teams. Inventory accuracy is broken on every purchase, causing overselling and fulfillment failures.

**Fix Plan:**
Re-enable stock update inside the same checkout transaction and guard against negative stock with conditional update / row lock.

## Bug 5: N+1 Query Pattern in Order History

**Severity:** MEDIUM
**File:** src/controllers/order.controller.js
**Line:** 27

**Root Cause:**
Order history fetches orders, then queries order_items per order, then product details per item. This creates N+1 (+M) queries and scales linearly with data size.

**Reproduction Steps:**

1. Generate users with many orders/items, then call `curl -X GET http://localhost:3000/api/orders/history -H "Authorization: Bearer <TOKEN>"`.
2. Observe query count and latency rise as order/item volume grows.
3. Expected vs actual: Expected bounded query count; actual query count increases with each order and item.

**Affected Users / Impact:**
Active buyers with large order histories. Endpoint gets progressively slower and can become unusable under load.

**Fix Plan:**
Replace iterative lookups with joined/batched queries (orders + items + products), then map rows to response objects in memory.
