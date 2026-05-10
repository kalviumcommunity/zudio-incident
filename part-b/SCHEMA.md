# PostgreSQL Schema Design

## Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Categories Table

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
```

## Products Table

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

```sql
CREATE INDEX idx_products_category_id ON products(category_id);
```

## Orders Table

```sql
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);
```

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

CREATE INDEX idx_orders_user_date
ON orders(user_id, created_at DESC);
```

## Order Items Table

```sql
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);
```

```sql
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

## Coupons Table

```sql
CREATE TABLE coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL CHECK (discount_amount >= 0),
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL
);
```

---

# Design Decisions

- NOT NULL constraints prevent incomplete data.
- CHECK constraints prevent invalid stock and pricing values.
- Foreign keys maintain relationship integrity.
- Composite index on orders(user_id, created_at DESC) fixes the Part A order history query bottleneck.
- Constraints enforce business rules directly at database level.