const pool = require('../db')

// get all orders for the logged in user
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.userId

    const result = await pool.query(
      `SELECT
         o.id AS order_id,
         o.user_id,
         o.total_amount,
         o.discount,
         o.shipping_address,
         o.status,
         o.created_at,
         o.updated_at,
         oi.id AS item_id,
         oi.product_id,
         oi.product_name,
         oi.product_price,
         oi.quantity,
         oi.unit_price,
         oi.created_at AS item_created_at,
         p.id AS product_id_ref,
         p.name AS product_name_ref,
         p.price AS product_price_ref,
         p.image_url
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC, oi.id ASC`,
      [userId]
    )

    const ordersById = new Map()

    for (const row of result.rows) {
      if (!ordersById.has(row.order_id)) {
        ordersById.set(row.order_id, {
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

      if (row.item_id) {
        ordersById.get(row.order_id).items.push({
          id: row.item_id,
          order_id: row.order_id,
          product_id: row.product_id,
          product_name: row.product_name,
          product_price: row.product_price,
          quantity: row.quantity,
          unit_price: row.unit_price,
          created_at: row.item_created_at,
          product: row.product_id_ref
            ? {
                id: row.product_id_ref,
                name: row.product_name_ref,
                price: row.product_price_ref,
                image_url: row.image_url,
              }
            : null,
        })
      }
    }

    const orders = Array.from(ordersById.values())

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
