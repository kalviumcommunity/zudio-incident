const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId

    // single optimized query: fetch all orders with their items and product details in one JOIN
    const result = await pool.query(
      `SELECT 
        o.id as order_id,
        o.user_id,
        o.total_amount,
        o.discount,
        o.shipping_address,
        o.status,
        o.created_at,
        o.updated_at,
        oi.id as item_id,
        oi.product_id,
        oi.product_name,
        oi.product_price,
        oi.quantity,
        oi.unit_price,
        p.image_url
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC, oi.id ASC`,
      [userId]
    )

    // transform flat result set into nested order structure
    const ordersMap = new Map()

    for (const row of result.rows) {
      // create order object if it doesn't exist
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          user_id: row.user_id,
          total_amount: row.total_amount,
          discount: row.discount,
          shipping_address: row.shipping_address,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          items: [],
        })
      }

      const order = ordersMap.get(row.order_id)

      // add item to order if this row has an item
      if (row.item_id) {
        order.items.push({
          id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_price: row.product_price,
          quantity: row.quantity,
          unit_price: row.unit_price,
          product: {
            id: row.product_id,
            name: row.product_name,
            price: row.product_price,
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
