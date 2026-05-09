const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId

    // FIXED: Replace N+1 query with single JOIN query
    // BUG: [HIGH] N+1 Query Problem — nested loops cause exponential queries.
    // Before: 1 + 50 orders + 250 items = 301 queries
    // After: 1 JOIN query with complete data
    const result = await pool.query(
      `SELECT o.id, o.total_amount, o.discount, o.shipping_address, o.status, o.created_at, o.updated_at,
              oi.id as item_id, oi.quantity, oi.unit_price,
              p.id as product_id, p.name as product_name, p.image_url
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC, oi.id`,
      [userId]
    )

    // Group results back into order structure
    const ordersMap = new Map()
    for (const row of result.rows) {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          total_amount: row.total_amount,
          discount: row.discount,
          shipping_address: row.shipping_address,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: [],
        })
      }

      if (row.item_id) {
        ordersMap.get(row.id).items.push({
          id: row.item_id,
          quantity: row.quantity,
          unit_price: row.unit_price,
          product: {
            id: row.product_id,
            name: row.product_name,
            image_url: row.image_url,
          },
        })
      }
    }

    const orders = Array.from(ordersMap.values())

    res.json({ orders })
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
