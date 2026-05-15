const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId
    // pagination
    const limit = parseInt(req.query.limit, 10) || 20
    const offset = parseInt(req.query.offset, 10) || 0

    // Single JOIN query to fetch orders with their items and product info (avoids N+1)
    const q = `
      SELECT o.id as order_id, o.total_amount, o.discount, o.status, o.created_at as order_created_at,
             oi.id as order_item_id, oi.quantity, oi.unit_price as unit_price_at_purchase,
             p.id as product_id, p.name as product_name, p.image_url
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `

    const result = await pool.query(q, [userId, limit, offset])

    // Group rows into orders with items
    const ordersMap = new Map()
    for (const row of result.rows) {
      let order = ordersMap.get(row.order_id)
      if (!order) {
        order = {
          id: row.order_id,
          total_amount: row.total_amount,
          discount: row.discount,
          status: row.status,
          created_at: row.order_created_at,
          items: [],
        }
        ordersMap.set(row.order_id, order)
      }

      order.items.push({
        id: row.order_item_id,
        product_id: row.product_id,
        product_name: row.product_name,
        image_url: row.image_url,
        quantity: row.quantity,
        unit_price_at_purchase: row.unit_price_at_purchase,
      })
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
