-- Zudio e-commerce schema for SQLite

-- Drop tables if they exist
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- categories
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- users
CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT,
  phone      TEXT,
  role       TEXT DEFAULT 'customer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- products
CREATE TABLE products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT,
  description TEXT,
  price       REAL,
  stock       INTEGER DEFAULT 0,
  category_id INTEGER REFERENCES categories(id),
  image_url   TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- orders
CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER REFERENCES users(id),
  total_amount     REAL,
  discount         REAL DEFAULT 0,
  shipping_address TEXT,
  status           TEXT DEFAULT 'pending',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- order_items
CREATE TABLE order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER REFERENCES orders(id),
  product_id    INTEGER REFERENCES products(id),
  product_name  TEXT,
  product_price REAL,
  quantity      INTEGER,
  unit_price    REAL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- coupons
CREATE TABLE coupons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT UNIQUE NOT NULL,
  discount_amount REAL,
  used            INTEGER DEFAULT 0,
  used_at         DATETIME,
  expires_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
