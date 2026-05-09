# Part B Schema Redesign

```sql
-- Normalized Zudio schema for Part B
-- Replaces nullable business-critical columns with explicit constraints,
-- adds foreign keys with delete behavior, and adds the indexes needed to
-- support the Part A hot paths.

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  phone      VARCHAR(20),
  role       VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name        VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_amount     NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  discount         NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_address TEXT NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coupons (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) NOT NULL UNIQUE,
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
  used            BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

## Commentary

### Why these constraints exist

- `users.name`, `users.password`, `products.name`, `products.price`, and `orders.shipping_address` are `NOT NULL` because Part A exposed logic paths that allowed incomplete records and inconsistent checkout state to persist.
- `orders.user_id NOT NULL` prevents the orphaned orders that Part A Bug 4 made possible when checkout was not fully protected by database rules.
- `users.role CHECK (...)` and `orders.status CHECK (...)` move the business-state validation into PostgreSQL so the app cannot write invalid states even if a controller bug regresses.
- `products.stock CHECK (stock >= 0)` and `order_items.quantity CHECK (quantity > 0)` enforce the same invariants that Part A Bug 4 violated at the application layer.
- `coupons.used NOT NULL DEFAULT FALSE` keeps the coupon redemption state explicit so the race condition from Part A Bug 3 can only be solved with an atomic update, not by guessing at null semantics.

### Why these foreign keys and delete rules exist

- `products.category_id REFERENCES categories(id) ON DELETE RESTRICT` prevents products from losing their category reference, which would break product browsing and reporting.
- `orders.user_id REFERENCES users(id) ON DELETE RESTRICT` keeps purchase history intact, which is safer than cascading deletes for financial records.
- `order_items.order_id REFERENCES orders(id) ON DELETE CASCADE` removes child rows automatically if an order is intentionally deleted, avoiding orphaned line items.
- `order_items.product_id REFERENCES products(id) ON DELETE RESTRICT` preserves historical order data and prevents accidental product deletion from destroying purchase history.

### Why the indexes exist

- `idx_orders_user_date` directly matches the Part A Bug 5 order-history query shape, replacing the sequential scan on `orders` with an index path on `(user_id, created_at DESC)`.
- `idx_order_items_order_id` supports the join from orders to order_items so the history endpoint can stay O(log n) on the order lookup instead of scanning the entire child table.
- `idx_order_items_product_id` supports product lookups from item rows and keeps the join cost stable as sales volume grows.
- `idx_products_category_id` keeps category browsing from degenerating into a full scan when the catalog grows during sale periods.
