const pool = require('../db')
const { sendError, sendSuccess } = require('../utils/api-response')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const limit = Math.max(1, Math.min(Number.parseInt(req.query.limit, 10) || 10, 50))
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0)

    const totalResult = await pool.query(
      'SELECT COUNT(*)::int AS total_orders FROM orders WHERE user_id = $1',
      [userId]
    )

    const historyResult = await pool.query(
      `WITH paginated_orders AS (
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
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3
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
       ORDER BY o.created_at DESC, o.id DESC, oi.created_at ASC, oi.id ASC`,
      [userId, limit, offset]
    )

    const ordersById = new Map()

    for (const row of historyResult.rows) {
      if (!ordersById.has(row.order_id)) {
        ordersById.set(row.order_id, {
          id: row.order_id,
          user_id: row.user_id,
          total_amount: row.total_amount,
          discount: row.discount,
          shipping_address: row.shipping_address,
          status: row.status,
          created_at: row.order_created_at,
          updated_at: row.order_updated_at,
          items: [],
        })
      }

      if (row.order_item_id) {
        ordersById.get(row.order_id).items.push({
          id: row.order_item_id,
          order_id: row.order_id,
          product_id: row.product_id,
          unit_price_at_purchase: row.unit_price_at_purchase,
          quantity: row.quantity,
          created_at: row.order_item_created_at,
          product: row.product_id
            ? {
              id: row.product_id,
              name: row.item_product_name,
              price: row.item_product_price,
              image_url: row.item_image_url,
            }
            : null,
        })
      }
    }

    return sendSuccess(res, 200, {
      orders: Array.from(ordersById.values()),
      pagination: {
        limit,
        offset,
        total: totalResult.rows[0]?.total_orders || 0,
      },
    })
  } catch (err) {
    console.error('getOrderHistory error:', err.message)
    return sendError(res, 500, 'ORDER_HISTORY_FAILED', 'Failed to fetch order history')
  }
}

// update order status — admin only
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status value')
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    )

    if (result.rows.length === 0) {
      return sendError(res, 404, 'ORDER_NOT_FOUND', 'Order not found')
    }

    return sendSuccess(res, 200, { message: 'Order status updated', order: result.rows[0] })
  } catch (err) {
    console.error('updateOrderStatus error:', err.message)
    return sendError(res, 500, 'ORDER_STATUS_UPDATE_FAILED', 'Failed to update order status')
  }
}

module.exports = { getOrderHistory, updateOrderStatus }
