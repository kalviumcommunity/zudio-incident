# Part B Schema

## Normalized PostgreSQL Schema

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('customer', 'admin'))
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL CHECK (discount_amount > 0),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  coupon_id INT REFERENCES coupons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  unit_price_at_purchase DECIMAL(10,2) NOT NULL CHECK (unit_price_at_purchase >= 0),
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products USING gin (to_tsvector('english', name));
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

## Why These Choices Exist

### `NOT NULL` on core relationship columns

`orders.user_id` is `NOT NULL` because Part A exposed orphaned-order risk when the order row could exist without an owner. The same logic applies to `order_items.order_id`, `order_items.product_id`, and the main identity fields in `users`, `products`, and `coupons`.

### Foreign keys with explicit delete behavior

`order_items.order_id` uses `ON DELETE CASCADE` because item rows should not survive if the parent order is purged. `products.category_id` and `order_items.product_id` use `RESTRICT` because deleting referenced master data would break historical and reporting queries.

### CHECK constraints for business rules

`stock >= 0`, `quantity > 0`, `total >= 0`, `discount_amount > 0`, `role IN (...)`, and `status IN (...)` move application rules into the database. That directly prevents the kinds of invalid rows Part A made possible through race conditions and incomplete validation.

### Indexes on every foreign key

PostgreSQL does not create FK indexes automatically, so the join-heavy lookup paths from Part A need explicit support. `idx_orders_user` and `idx_order_items_order` are the baseline fixes, and `idx_orders_user_date` is the higher-value composite index that matches the order history query pattern.

### Denormalization removed from order items

The purchase price is stored as `unit_price_at_purchase` instead of repeating product name and current product price in every order row. That preserves historical accuracy while still allowing the current product catalog to evolve independently.

## Part A Connection

- Missing indexes: fixed by indexing the FK columns and the order history access path.
- Orphaned rows and validation gaps: fixed by `NOT NULL`, `CHECK`, and FK constraints.
- Checkout race conditions: the schema supports safe transactional updates by keeping the write path normalized.
