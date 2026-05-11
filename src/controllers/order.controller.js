const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const { offset = 0 } = req.query

    const result = await pool.query(
      `WITH paged_orders AS (
         SELECT id, user_id, total_amount, discount, shipping_address, status, created_at, updated_at
         FROM orders
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20 OFFSET $2
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
         oi.product_name,
         oi.product_price,
         oi.quantity,
         oi.unit_price,
         oi.created_at AS item_created_at,
         p.name AS current_product_name,
         p.price AS current_product_price,
         p.image_url
       FROM paged_orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       ORDER BY o.created_at DESC, oi.created_at ASC`,
      [userId, parseInt(offset)]
    )

    const ordersMap = new Map()

    for (const row of result.rows) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
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

      ordersMap.get(row.order_id).items.push({
        id: row.order_item_id,
        order_id: row.order_id,
        product_id: row.product_id,
        product_name: row.product_name,
        product_price: row.product_price,
        quantity: row.quantity,
        unit_price: row.unit_price,
        created_at: row.item_created_at,
        product: {
          id: row.product_id,
          name: row.current_product_name,
          price: row.current_product_price,
          image_url: row.image_url,
        },
      })
    }

    res.json({ orders: Array.from(ordersMap.values()) })
  } catch (err) {
    console.error('getOrderHistory error:', err.message)
    res.status(500).json({ error: 'Failed to fetch order history' })
  }
}

// update order status — admin only
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' })
    }

    res.json({ message: 'Order status updated', order: result.rows[0] })
  } catch (err) {
    console.error('updateOrderStatus error:', err.message)
    res.status(500).json({ error: 'Failed to update order status' })
  }
}

module.exports = { getOrderHistory, updateOrderStatus }
