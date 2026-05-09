-- created by contractor, 2023-08 -- reach out to Vikram if questions
-- Migration: 001_create_tables
-- Zudio e-commerce schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- clean up if re-running (handy during dev)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------
-- categories
-- ------------------------------------------------------------
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- users
-- role is constrained to customer/admin
-- password is hashed before insert
-- ------------------------------------------------------------
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  phone      VARCHAR(20),
  role       VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- no index on email beyond the unique constraint (unique already creates one)

-- ------------------------------------------------------------
-- products
-- category_id now has a supporting index for catalog browsing
-- ------------------------------------------------------------
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  image_url   TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category_created_at ON products(category_id, created_at DESC);

-- ------------------------------------------------------------
-- orders
-- user_id is required and indexed to support order history lookups
-- ------------------------------------------------------------
CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount     NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  discount         NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_address TEXT NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at_id ON orders(user_id, created_at DESC, id DESC);

-- ------------------------------------------------------------
-- order_items
-- 3NF: product metadata stays in products, purchase price is captured once
-- quantity and price are constrained to valid positive values
-- ------------------------------------------------------------
CREATE TABLE order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  unit_price_at_purchase NUMERIC(10, 2) NOT NULL CHECK (unit_price_at_purchase >= 0),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_created_at ON order_items(order_id, created_at ASC, id ASC);

-- ------------------------------------------------------------
-- coupons
-- single-use coupons, no per-user limit
-- used flag is locked atomically during checkout
-- ------------------------------------------------------------
CREATE TABLE coupons (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) UNIQUE NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
  used            BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMP NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
