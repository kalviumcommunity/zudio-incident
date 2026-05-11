# Normalized PostgreSQL Schema

## Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL
    CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Products Table

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL
    CHECK (price >= 0),
  stock INT NOT NULL
    CHECK (stock >= 0),
  category VARCHAR(100),
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Orders Table

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,
  total DECIMAL(10,2) NOT NULL
    CHECK (total >= 0),
  status VARCHAR(50) NOT NULL
    CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

```sql
CREATE INDEX idx_orders_user
ON orders(user_id);

CREATE INDEX idx_orders_user_date
ON orders(user_id, created_at DESC);
```

---

## Order Items Table

```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,
  product_id INT NOT NULL
    REFERENCES products(id)
    ON DELETE RESTRICT,
  unit_price_at_purchase DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL
    CHECK (quantity > 0)
);
```

```sql
CREATE INDEX idx_order_items_order
ON order_items(order_id);

CREATE INDEX idx_order_items_product
ON order_items(product_id);
```

---

# Design Decisions

## NOT NULL Constraints

Part A exposed orphaned records caused by missing validation.
NOT NULL constraints ensure essential relationships always exist.

## Foreign Keys

Foreign keys enforce relational integrity between users,
orders, and products.

## CHECK Constraints

CHECK constraints prevent invalid business states such as:

- negative stock
- zero quantity orders
- invalid roles
- invalid order status

## Composite Index

The index on `(user_id, created_at DESC)` directly optimizes
the order history query identified in Part A.