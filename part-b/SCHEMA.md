# Part B Schema Redesign (3NF)

## Normalized PostgreSQL Schema

```sql
-- USERS
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- CATEGORIES
CREATE TABLE categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  slug  VARCHAR(100) UNIQUE NOT NULL
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
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name_fts ON products USING gin (to_tsvector('english', name));

-- COUPONS
CREATE TABLE coupons (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(50) UNIQUE NOT NULL,
  discount_amount  DECIMAL(10,2) NOT NULL CHECK (discount_amount > 0),
  used             BOOLEAN NOT NULL DEFAULT false,
  used_at          TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coupons_code ON coupons(code);

-- ORDERS
CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total        DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  coupon_id    INT REFERENCES coupons(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);

-- ORDER ITEMS
CREATE TABLE order_items (
  id                      SERIAL PRIMARY KEY,
  order_id                INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id              INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  unit_price_at_purchase  DECIMAL(10,2) NOT NULL CHECK (unit_price_at_purchase >= 0),
  quantity                INT NOT NULL CHECK (quantity > 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

## Why These Decisions (Linked to Part A)

1. `NOT NULL` on ownership/critical fields:
Prevents invalid rows such as orders without users. This protects integrity around checkout flow where Part A Bug 4 showed stock/order consistency issues.

2. Strict foreign keys with explicit `ON DELETE`:
Stops orphaned `order_items` and invalid references under deletes. This addresses data drift risk discovered while tracing Part A order and checkout paths.

3. `CHECK` constraints for stock, quantity, totals, role, and status:
Enforces business rules in DB even if app logic regresses. Part A had logic bugs (double discount and stock handling), so DB-level safety nets are mandatory.

4. 3NF order item design:
`order_items` stores only purchase-time price + FK, not mutable product fields like name and current price. This removes denormalization anomalies present in the old model.

5. FK and composite indexes:
Part A order history profile showed severe query cost patterns. Indexes on FK columns plus `(user_id, created_at DESC)` match order history access and reduce scan cost.
