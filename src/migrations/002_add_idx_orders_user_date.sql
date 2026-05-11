-- Migration: 002_add_idx_orders_user_date
-- Purpose: Optimize order history access pattern (WHERE user_id = ? ORDER BY created_at DESC)

DROP INDEX IF EXISTS idx_orders_user_id_created_at;
CREATE INDEX IF NOT EXISTS idx_orders_user_date
  ON orders(user_id, created_at DESC);
