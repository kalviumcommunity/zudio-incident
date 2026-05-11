const pool = require('../db')

// get all orders for the logged in user — optimized to avoid N+1 queries
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId

    // Fetch all orders for the user with items and products in ONE query (2 round-trips total: orders + items_with_products)
    // First: fetch all orders
    const ordersRes = await pool.query(
      `SELECT id, total_amount, discount, status, created_at FROM orders
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    const orders = ordersRes.rows

    if (orders.length === 0) {
      return res.json({ orders: [] })
    }

    // Second: fetch all items + products for all orders of this user (avoids N+1)
    const itemsRes = await pool.query(
      `SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_price, oi.quantity, oi.unit_price,
              p.id as product_id_db, p.name, p.price, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id IN (SELECT id FROM orders WHERE user_id = $1)
       ORDER BY oi.order_id`,
      [userId]
    )

    // Group items by order_id
    const itemsByOrderId = {}
    itemsRes.rows.forEach(item => {
      if (!itemsByOrderId[item.order_id]) {
        itemsByOrderId[item.order_id] = []
      }
      itemsByOrderId[item.order_id].push({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_price: item.product_price,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product: {
          id: item.product_id_db,
          name: item.name,
          price: item.price,
          image_url: item.image_url
        }
      })
    })

    // Attach items to orders
    const result = orders.map(order => ({
      ...order,
      items: itemsByOrderId[order.id] || []
    }))

    res.json({ orders: result })
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
