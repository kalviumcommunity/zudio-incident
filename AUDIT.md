# Endpoint Profiling Audit

| Endpoint | Response Time | Query Count | Observation |
|---|---|---|---|
| GET /api/products | 83ms | 1 | Product listing endpoint performs efficiently with a single query |
| GET /api/products?search=shirt | 52ms | 1 | Search filtering works correctly with low response time |
| GET /api/orders/history | 11ms | 1 | Authenticated endpoint responds quickly for empty order history |
| POST /api/cart/checkout | 4ms | 0 | Request rejected early because cart is empty, so no DB queries executed |

---

# Profiling Observations

- Query counting middleware successfully tracks database usage.
- Product-related endpoints currently execute efficiently with one database query.
- Authentication-protected routes show low response times.
- Checkout validation stops invalid requests before unnecessary database operations occur.

## Bug 1: SQL Injection in Product Search

**Severity:** CRITICAL  
**File:** src/controllers/product.controller.js  
**Line:** Approx. line 15  

**Root Cause:**  
User-controlled input is directly concatenated into the SQL query string instead of using parameterized queries.

**Reproduction Steps:**  
1. Send GET request:
   `/api/products?search=shirt' OR '1'='1`
2. Observe all products are returned.
3. Expected: filtered results only. Actual: query bypassed.

**Affected Users / Impact:**  
All users are affected. Attackers may read or manipulate database contents through crafted SQL payloads.

**Fix Plan:**  
Replace string concatenation with parameterized prepared statements using query placeholders.

---

## Bug 2: Plaintext Password Storage

**Severity:** HIGH  
**File:** src/controllers/auth.controller.js  
**Line:** Approx. line 25  

**Root Cause:**  
Passwords are stored directly in the database without hashing or salting.

**Reproduction Steps:**  
1. Register a new user.
2. Inspect database user table.
3. Observe raw password stored directly.

**Affected Users / Impact:**  
All registered users are at risk if database access is compromised.

**Fix Plan:**  
Use bcrypt hashing before storing passwords and compare hashes during login.

---

## Bug 3: Coupon Reuse Race Condition

**Severity:** HIGH  
**File:** src/controllers/checkout.controller.js  
**Line:** Approx. line 40  

**Root Cause:**  
Coupon validation and coupon usage update happen in separate database operations without transactional locking.

**Reproduction Steps:**  
1. Send multiple checkout requests simultaneously using the same coupon.
2. Observe coupon accepted multiple times.
3. Expected: coupon usable once only. Actual: multiple successful redemptions.

**Affected Users / Impact:**  
Causes revenue loss and inconsistent order pricing during concurrent traffic.

**Fix Plan:**  
Use transactional locking or atomic update queries to validate and consume coupons safely.

---

## Bug 4: Inventory Stock Not Updated

**Severity:** CRITICAL  
**File:** src/controllers/checkout.controller.js  
**Line:** Approx. line 70 and 105  

**Root Cause:**  
Inventory update queries are commented out, so stock levels never decrease after purchases.

**Reproduction Steps:**  
1. Complete checkout successfully.
2. Check product inventory values.
3. Observe stock remains unchanged.

**Affected Users / Impact:**  
Products can be oversold indefinitely, causing severe inventory inconsistencies.

**Fix Plan:**  
Re-enable stock decrement queries and wrap checkout logic inside a transaction.

---

## Bug 5: N+1 Query Performance Issue

**Severity:** MEDIUM  
**File:** src/controllers/order.controller.js  
**Line:** Approx. line 15  

**Root Cause:**  
Additional database queries are executed inside nested loops instead of batching related data retrieval.

**Reproduction Steps:**  
1. Request order history for a user with many orders.
2. Observe query count and response time increase rapidly.
3. Expected: efficient batched queries. Actual: repeated database hits per item.

**Affected Users / Impact:**  
Users with large order histories experience slow page loads and degraded performance.

**Fix Plan:**  
Replace nested queries with JOIN-based queries or batch-fetch related data.

# Verification Table

| Bug | Before | After | Verification Method |
|-----|--------|-------|---------------------|
| SQL Injection | Search input returned all products using injected SQL | Input treated as literal string and returns valid filtered results only | GET /api/products?search=shirt' OR '1'='1 |
| Plaintext Passwords | Passwords stored directly as plain text | Passwords stored securely using bcrypt hashing | SELECT password FROM users |
| Double Discount | Same coupon could be reused in concurrent requests | Coupon becomes unavailable immediately after first successful use | POST /api/cart/checkout using same coupon twice |
| Stock Decrement | Product stock remained unchanged after checkout | Stock decreases correctly after successful order placement | Compare product stock before and after checkout |
| N+1 Order History | Multiple queries executed inside loops causing slow responses | Single JOIN query fetches complete order history efficiently | Profiling middleware output for GET /api/orders/history |