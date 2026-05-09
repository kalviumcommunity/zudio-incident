# Proposed Database Schema for 1 Lakh Users

```text
users
	id (PK)
	name
	email (UNIQUE)
	password_hash
	phone
	role (CHECK: customer|admin)
	created_at
	updated_at

categories
	id (PK)
	name (UNIQUE)
	description
	created_at

products
	id (PK)
	category_id (FK -> categories.id)
	name
	description
	price
	stock (CHECK: stock >= 0)
	image_url
	created_at
	updated_at

orders
	id (PK)
	user_id (FK -> users.id, NOT NULL)
	total_amount
	discount
	shipping_address
	status
	created_at
	updated_at

order_items
	id (PK)
	order_id (FK -> orders.id, NOT NULL)
	product_id (FK -> products.id, NOT NULL)
	product_name
	product_price
	quantity (CHECK: quantity > 0)
	unit_price
	created_at

coupons
	id (PK)
	code (UNIQUE)
	discount_amount
	used
	expires_at
	created_at
```

## Design Choices

### Users

Split authentication data into `password_hash` so passwords are never stored in plaintext. This directly fixes [Part A Bug 2](../AUDIT.md), where registration stored raw passwords and login compared plain strings.

### Categories

Keep categories normalized because product browsing depends on a stable category lookup and category names are already queried as a separate dimension. The unique category name also prevents duplicate taxonomy rows from creating inconsistent product filters.

### Products

Add an index on `products.category_id` and a search-friendly index on `products.name` so product listing and search do not rely on full table scans. That addresses [Part A Bug 1](../AUDIT.md) and the product-list profiling result, where reads should stay fast even as the catalog grows.

### Orders

Make `orders.user_id` `NOT NULL` and index it so order history can be fetched with a bounded lookup path instead of scanning every order. This is the schema-side fix for [Part A Bug 5](../AUDIT.md), where order history showed a `1+N+M` pattern.

### Order Items

Keep the denormalized `product_name` and `product_price` snapshot fields so historical orders remain correct even if the live product changes later. Add indexes on `order_id` and `product_id` because checkout and history both depend on those joins, and [Part A Bug 5](../AUDIT.md) showed the current order-item access pattern is too expensive.

### Coupons

Keep coupon state in one table with a unique code and a used flag so the checkout transaction can claim a coupon atomically. That supports the fix for [Part A Bug 3](../AUDIT.md), which came from non-atomic coupon reuse checks.

## Required Indexes

```sql
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE INDEX idx_coupons_code_used ON coupons(code, used);
```

The `products.name` trigram index supports fast `ILIKE` search, which is the schema-level response to [Part A Bug 1](../AUDIT.md). The `orders.user_id` and `order_items.order_id` indexes remove the worst part of the history query pattern in [Part A Bug 5](../AUDIT.md).

## Constraints

```sql
ALTER TABLE users
	ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin'));

ALTER TABLE products
	ADD CONSTRAINT products_stock_check CHECK (stock >= 0),
	ADD CONSTRAINT products_price_check CHECK (price >= 0);

ALTER TABLE orders
	ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE order_items
	ALTER COLUMN order_id SET NOT NULL,
	ALTER COLUMN product_id SET NOT NULL,
	ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0);
```

These constraints move application assumptions into the database so invalid data cannot leak in through a buggy endpoint or manual SQL. In particular, they protect inventory integrity for [Part A Bug 4](../AUDIT.md) and keep user roles bounded so the auth layer cannot silently accept arbitrary values.

## Why This Holds Up at 1 Lakh Users

The schema keeps write-heavy entities small and normalized, while the expensive read paths are covered by indexes and the architecture routes repeated reads to Redis and read replicas. That combination is what removes the Part A bottlenecks: unsafe search, plaintext auth, coupon races, stock drift, and the N+1 history query.

Order history remains denormalized at the item level so completed orders are immutable records, which is the correct tradeoff for e-commerce auditability. With indexed foreign keys and read replicas, those historical reads stay cheap even when the user base grows into the 1 lakh range.
