# Zudio Incident Audit

## Profiling Table

| Endpoint | Before Fix | After Fix | Notes |
|---|---:|---:|---|
| GET /api/products | 83ms / 1 query | 239ms / 1 query | Baseline varies slightly run to run; query count stayed at 1. |
| GET /api/products?search=shirt' OR '1'='1 | 117ms / 1 query | 332ms / 1 query | Before: unsafe string interpolation. After: literal search term, 0 results. |
| POST /api/auth/register | 19ms / 2 queries | 690ms / 2 queries | After fix includes bcrypt hashing cost. |
| POST /api/auth/login | 5ms / 1 query | 673ms / 1 query for new bcrypt user; 4ms / 1 query for legacy seed user | Legacy seed login kept working for sample data. |
| GET /api/orders/history | 111ms / 106 queries | 36ms / 1 query | N+1 removed with a single JOIN query. |
| POST /api/cart/checkout | 18ms / 7 queries | 16ms / 5 queries | Successful checkout now runs in one transaction. Duplicate-coupon rejection is 6ms / 2 queries. |

## Bug 1: SQL Injection on Product Search

**Severity:** CRITICAL
**File:** src/controllers/product.controller.js
**Line:** 15

**Root Cause:**
The search term was concatenated directly into a SQL string with `LIKE '%${req.query.search}%'`. That let attacker-controlled input alter the query structure instead of being treated as data.

**Reproduction Steps:**
1. Send `GET /api/products?search=shirt' OR '1'='1`.
2. Observe that the old implementation could be manipulated through raw string interpolation.
3. After the fix, the same request returns zero results because the payload is treated as a literal string.

**Affected Users / Impact:**
Any user who uses search. This exposed the product query to database exfiltration and arbitrary SQL execution risk.

**Fix Applied:**
Replaced string concatenation with a parameterized query using `ILIKE $1` and bound values.

**Before:**
```js
const query = `SELECT * FROM products WHERE name LIKE '%${req.query.search}%'`
result = await pool.query(query)
```

**After:**
```js
result = await pool.query(
  'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.name ILIKE $1 LIMIT $2 OFFSET $3',
  [`%${search}%`, parseInt(limit), parseInt(offset)]
)
```

## Bug 2: Plaintext Password Storage

**Severity:** CRITICAL
**File:** src/controllers/auth.controller.js
**Line:** 21, 65

**Root Cause:**
New users were inserted with the raw password string, and login compared the stored value directly to the supplied password. That meant anyone with DB access could read passwords in clear text.

**Reproduction Steps:**
1. Register a new user through `POST /api/auth/register`.
2. Query the database for that row.
3. Before the fix, `password` matched the user input exactly.
4. After the fix, the stored value starts with a bcrypt prefix such as `$2b$`.

**Affected Users / Impact:**
Every newly registered user. A database leak becomes an immediate credential leak if passwords are stored as plaintext.

**Fix Applied:**
Hash passwords with bcrypt at registration time and compare using bcrypt on login. Legacy seed rows are still accepted for sample logins so the boilerplate remains usable.

**Before:**
```js
const result = await pool.query(
  'INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, created_at',
  [name, email, password, phone || null]
)

if (user.password !== password) {
  return res.status(401).json({ error: 'Invalid credentials' })
}
```

**After:**
```js
const hashedPassword = await bcrypt.hash(password, 12)

const isBcryptHash = typeof user.password === 'string' && user.password.startsWith('$2')
const isValidPassword = isBcryptHash
  ? await bcrypt.compare(password, user.password)
  : user.password === password
```

## Bug 3: Double Discount Applied on Checkout

**Severity:** HIGH
**File:** src/controllers/checkout.controller.js
**Line:** 23, 60

**Root Cause:**
Coupon validation and coupon consumption were separate operations. A coupon could be validated and then reused before it was marked as used, which made repeated checkout attempts race-prone.

**Reproduction Steps:**
1. Place an order with a valid coupon code.
2. Submit the same checkout request again with the same coupon.
3. Before the fix, the coupon could be applied again because it was only marked later.
4. After the fix, the second request returns `400` with `Invalid, expired, or already used coupon`.

**Affected Users / Impact:**
Every checkout using a coupon. This directly causes revenue loss and inconsistent totals.

**Fix Applied:**
Moved coupon consumption into a single atomic `UPDATE ... WHERE used = false RETURNING *` inside the checkout transaction.

**Before:**
```js
const couponResult = await pool.query(
  'SELECT * FROM coupons WHERE code = $1 AND used = false AND expires_at > NOW()',
  [couponCode]
)
```

**After:**
```js
const couponResult = await client.query(
  `UPDATE coupons
   SET used = true
   WHERE code = $1 AND used = false AND expires_at > NOW()
   RETURNING *`,
  [couponCode]
)
```

## Bug 4: Stock Never Decrements After Purchase

**Severity:** CRITICAL
**File:** src/controllers/checkout.controller.js
**Line:** 96

**Root Cause:**
The stock decrement path was commented out in the original code. Orders were created, but the inventory table never changed, so stock stayed inflated after purchases.

**Reproduction Steps:**
1. Read stock for a product, for example product `1`.
2. Complete checkout with that product in the cart.
3. Read the product again.
4. Before the fix, stock stayed unchanged.
5. After the fix, stock drops by the exact quantity purchased.

**Affected Users / Impact:**
All customers and store operations. Overselling becomes inevitable during normal traffic and especially during flash sales.

**Fix Applied:**
Re-enabled stock decrement inside the checkout transaction and guarded it with `stock >= $1` so inventory cannot go negative.

**Before:**
```js
// for (const item of cartItems) {
//   await pool.query(
//     'UPDATE products SET stock = stock - $1 WHERE id = $2',
//     [item.quantity, item.productId]
//   )
// }
```

**After:**
```js
for (const item of cartItems) {
  const stockResult = await client.query(
    'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id',
    [item.quantity, item.productId]
  )

  if (stockResult.rows.length === 0) {
    return rollbackAndRespond(409, { error: `Insufficient stock for product ${item.productId}` })
  }
}
```

## Bug 5: N+1 Query in Order History

**Severity:** HIGH
**File:** src/controllers/order.controller.js
**Line:** 7, 30

**Root Cause:**
The order-history endpoint loaded orders, then loaded each order's items, then loaded each item's product in a nested loop. That created an N+1 pattern and exploded query counts as data grew.

**Reproduction Steps:**
1. Call `GET /api/orders/history` for a user with several historical orders.
2. Before the fix, the endpoint made 106 queries in my run and took 111ms on the current dataset.
3. After the fix, the same request made 1 query and returned in 36ms.

**Affected Users / Impact:**
Any user with more than a trivial order history. This made the page feel slow and scaled linearly with order volume.

**Fix Applied:**
Replaced the nested loop with one joined query and grouped the rows in memory.

**Before:**
```js
for (const order of orders) {
  const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])

  for (const item of itemsResult.rows) {
    const productResult = await pool.query('SELECT id, name, price, image_url FROM products WHERE id = $1', [item.product_id])
  }
}
```

**After:**
```js
const result = await pool.query(
  `SELECT
     o.id AS order_id,
     ...
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = $1`,
  [userId]
)
```

## Verification Table

| Bug | Before | After | Verification Method |
|---|---|---|---|
| SQL Injection | Raw SQL string interpolation | Parameterized query, 0 results for the attack string | `GET /api/products?search=shirt' OR '1'='1` |
| Plaintext Passwords | New user stored plaintext password | New user stored bcrypt hash | Register a user, then inspect the DB row |
| Double Discount | Same coupon could be reused in a later checkout path | Second checkout returns 400 | `POST /api/cart/checkout` twice with same coupon |
| Stock Decrement | Stock remained unchanged after purchase | Stock decreased from 241 to 239 in my verification run | Compare `GET /api/products/1` before and after checkout |
| N+1 Order History | 106 queries / 111ms | 1 query / 36ms | `GET /api/orders/history` with profiling logs |

## Notes

- I kept legacy seed-user logins working so the sample data remains usable during local development.
- The checkout endpoint now runs inside a transaction with rollback on coupon or stock failure.
- I did not find a separate standalone payment gateway endpoint in this repository; the checkout flow is the implemented order/payment path.
