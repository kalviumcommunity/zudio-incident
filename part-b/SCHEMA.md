# Step 4 - PostgreSQL Schema Redesign (3NF)

## Complete Normalized Schema (SQL)

```sql
-- USERS
CREATE TABLE users (
	id          SERIAL PRIMARY KEY,
	email       VARCHAR(255) UNIQUE NOT NULL,
	password    VARCHAR(255) NOT NULL,
	name        VARCHAR(100) NOT NULL,
	phone       VARCHAR(20),
	role        VARCHAR(20) NOT NULL DEFAULT 'customer'
							CHECK (role IN ('customer', 'admin')),
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- CATEGORIES
CREATE TABLE categories (
	id          SERIAL PRIMARY KEY,
	name        VARCHAR(100) UNIQUE NOT NULL,
	slug        VARCHAR(100) UNIQUE NOT NULL,
	description TEXT,
	created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE products (
	id           SERIAL PRIMARY KEY,
	category_id  INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
	name         VARCHAR(255) NOT NULL,
	description  TEXT,
	price        DECIMAL(10,2) NOT NULL CHECK (price >= 0),
	stock        INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
	image_url    VARCHAR(500),
	created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- COUPONS
CREATE TABLE coupons (
	id               SERIAL PRIMARY KEY,
	code             VARCHAR(50) UNIQUE NOT NULL,
	discount_amount  DECIMAL(10,2) NOT NULL CHECK (discount_amount > 0),
	used             BOOLEAN NOT NULL DEFAULT FALSE,
	used_at          TIMESTAMPTZ,
	expires_at       TIMESTAMPTZ NOT NULL,
	created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_expires_at ON coupons(expires_at);

-- ORDERS
CREATE TABLE orders (
	id               SERIAL PRIMARY KEY,
	user_id          INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	coupon_id        INT REFERENCES coupons(id) ON DELETE SET NULL,
	total_amount     DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
	discount         DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
	shipping_address TEXT NOT NULL,
	status           VARCHAR(20) NOT NULL DEFAULT 'pending'
									 CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
	created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_coupon_id ON orders(coupon_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- ORDER ITEMS (3NF)
CREATE TABLE order_items (
	id                      SERIAL PRIMARY KEY,
	order_id                INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	product_id              INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
	quantity                INT NOT NULL CHECK (quantity > 0),
	unit_price_at_purchase  DECIMAL(10,2) NOT NULL CHECK (unit_price_at_purchase >= 0),
	created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

## Commentary - Why Each Design Decision Exists (Part A Continuity)

1. NOT NULL constraints added where null would create invalid business state.
`orders.user_id NOT NULL` prevents orphaned orders that were possible in the old schema and aligns with the integrity problems observed around checkout correctness in Part A Bug 4. `products.name`, `products.price`, `orders.shipping_address`, and `order_items.quantity` are also NOT NULL so incomplete writes cannot silently enter production data.

2. Foreign keys now use explicit ON DELETE actions.
Every relationship uses a deliberate delete policy: `order_items.order_id` uses `ON DELETE CASCADE`, while `product_id` and `user_id` use `ON DELETE RESTRICT` to preserve historical integrity. This addresses the Part A lesson that application-only safeguards are fragile under bug conditions (Bug 3 and Bug 4).

3. CHECK constraints enforce business rules at the database layer.
`stock >= 0`, `quantity > 0`, `total_amount >= 0`, `discount >= 0`, role enum, and status enum prevent impossible states even if controller logic regresses. This is directly motivated by Part A's logic failures where checkout state could become inconsistent under concurrency and missing guards.

4. 3NF normalization removes denormalized product fields from `order_items`.
`order_items` no longer stores `product_name` and `product_price` duplicates; it stores only `product_id` plus `unit_price_at_purchase` for immutable purchase-time pricing. This eliminates update anomalies and keeps current catalog data centralized in `products`.

5. Indexes are added on all foreign keys used by read paths.
PostgreSQL does not auto-index foreign keys, so explicit indexes are created for `products.category_id`, `orders.user_id`, `orders.coupon_id`, `order_items.order_id`, and `order_items.product_id`. This targets the exact performance risk pattern surfaced in Part A profiling.

6. Composite index on `orders(user_id, created_at DESC)` is mandatory for order history.
Part A Bug 5 profiling showed order-history access is filter-by-user and sort-by-created_at descending; this is the precise access pattern for the composite index. The index keeps pagination efficient as order volume grows and prevents regression toward high-latency history reads.
