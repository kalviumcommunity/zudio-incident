const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    const { offset = 0 } = req.query

    // to scale linearly with number of orders and items.

    const result = await pool.query(
      `SELECT
        o.id AS order_id,
        o.total_amount,
        o.status,
        o.created_at,

        oi.quantity,
        oi.unit_price,

        p.id AS product_id,
        p.name AS product_name,
        p.image_url

      FROM orders o

      JOIN order_items oi
        ON oi.order_id = o.id

      JOIN products p
        ON p.id = oi.product_id

      WHERE o.user_id = $1

      ORDER BY o.created_at DESC

      LIMIT 20 OFFSET $2`,
      [userId, parseInt(offset)]
    )

    res.json({
      orders: result.rows,
    })
  } catch (err) {
    console.error('getOrderHistory error:', err.message)

    res.status(500).json({
      error: 'Failed to fetch order history',
    })
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
