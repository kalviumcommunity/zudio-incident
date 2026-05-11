const pool = require('../db')

const checkout = async (req, res) => {
  const userId = req.user.userId
  const { items, couponCode, shippingAddress } = req.body

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' })
  }

  if (!shippingAddress) {
    return res.status(400).json({ error: 'Shipping address is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // load and check product stock (SQLite locks implicitly in transaction)
    const cartItems = []
    let totalAmount = 0

    for (const item of items) {
      const prodRes = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1',
        [item.productId]
      )
      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: `Product ${item.productId} not found` })
      }
      const product = prodRes.rows[0]
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` })
      }
      totalAmount += parseFloat(product.price) * item.quantity
      cartItems.push({ ...item, product })
    }

    let discount = 0

    // atomically claim coupon if provided
    if (couponCode) {
      const couponUpdate = await client.query(
        'UPDATE coupons SET used = 1, used_at = CURRENT_TIMESTAMP WHERE code = $1 AND used = 0 AND expires_at > CURRENT_TIMESTAMP RETURNING id, discount_amount',
        [couponCode]
      )
      if (couponUpdate.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid or already used coupon' })
      }
      discount = parseFloat(couponUpdate.rows[0].discount_amount)
      totalAmount = Math.max(0, totalAmount - discount)
    }

    // create order
    const orderInsert = await client.query(
      'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, totalAmount, discount, shippingAddress, 'pending']
    )
    const order = orderInsert.rows[0]

    // insert items and decrement stock
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, item.productId, item.product.name, item.product.price, item.quantity, item.product.price]
      )

      const stockUpdate = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id',
        [item.quantity, item.productId]
      )
      if (stockUpdate.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: `Insufficient stock for product ${item.productId}` })
      }
    }

    await client.query('COMMIT')
    res.status(201).json({ message: 'Order placed successfully', order, discount })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('checkout error:', err.message)
    res.status(500).json({ error: 'Checkout failed' })
  } finally {
    client.release()
  }
}

module.exports = { checkout }
