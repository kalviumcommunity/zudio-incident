-- Benchmark order history query path
-- Run this against a seeded local database.
-- Capture EXPLAIN ANALYZE output before and after the composite index.

-- BEFORE
-- Temporarily drop the composite index, then run the query below.
-- DROP INDEX IF EXISTS idx_orders_user_created_at_id;

EXPLAIN ANALYZE
WITH paginated_orders AS (
  SELECT
    id,
    user_id,
    total_amount,
    discount,
    shipping_address,
    status,
    created_at,
    updated_at
  FROM orders
  WHERE user_id = 1
  ORDER BY created_at DESC, id DESC
  LIMIT 10 OFFSET 0
)
SELECT
  o.id AS order_id,
  o.user_id,
  o.total_amount,
  o.discount,
  o.shipping_address,
  o.status,
  o.created_at AS order_created_at,
  o.updated_at AS order_updated_at,
  oi.id AS order_item_id,
  oi.product_id,
  oi.unit_price_at_purchase,
  oi.quantity,
  oi.created_at AS order_item_created_at,
  p.name AS item_product_name,
  p.price AS item_product_price,
  p.image_url AS item_image_url
FROM paginated_orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN products p ON p.id = oi.product_id
ORDER BY o.created_at DESC, o.id DESC, oi.created_at ASC, oi.id ASC;

-- AFTER
-- Recreate the composite index, then run the same EXPLAIN ANALYZE block again.
-- CREATE INDEX IF NOT EXISTS idx_orders_user_created_at_id ON orders(user_id, created_at DESC, id DESC);
