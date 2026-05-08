const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId

    // fetch orders with items and product details in a single query (avoid N+1)
    const rows = await pool.query(
      `SELECT o.id as order_id, o.user_id, o.total_amount, o.discount, o.status, o.created_at,
              oi.id as order_item_id, oi.product_id, oi.quantity, oi.unit_price,
              p.name as product_name, p.image_url
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    )

    // group rows by order
    const ordersMap = new Map()
    for (const r of rows.rows) {
      const oid = r.order_id
      if (!ordersMap.has(oid)) {
        ordersMap.set(oid, {
          id: oid,
          user_id: r.user_id,
          total_amount: r.total_amount,
          discount: r.discount,
          status: r.status,
          created_at: r.created_at,
          items: [],
        })
      }

      const order = ordersMap.get(oid)
      order.items.push({
        id: r.order_item_id,
        product_id: r.product_id,
        quantity: r.quantity,
        unit_price: r.unit_price,
        product: r.product_name ? { name: r.product_name, image_url: r.image_url } : null,
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
