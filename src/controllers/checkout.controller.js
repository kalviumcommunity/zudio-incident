const pool = require('../db')

const checkout = async (req, res) => {
  let client
  try {
    const userId = req.user.userId
    const { items, couponCode, shippingAddress } = req.body

    // items should be an array of { productId, quantity }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'Shipping address is required' })
    }

    // use a dedicated client so we can run a transaction
    client = await pool.connect()
    await client.query('BEGIN')

    // calculate total price and lock product rows
    let totalAmount = 0
    const cartItems = []

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      )

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: `Product ${item.productId} not found` })
      }

      const product = productResult.rows[0]

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` })
      }

      totalAmount += parseFloat(product.price) * item.quantity
      cartItems.push({ ...item, product })
    }

    let discount = 0

    // If coupon provided, atomically claim it using UPDATE...RETURNING
    if (couponCode) {
      const couponUpdate = await client.query(
        'UPDATE coupons SET used = true WHERE code = $1 AND used = false AND expires_at > NOW() RETURNING *',
        [couponCode]
      )

      if (couponUpdate.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }

      const coupon = couponUpdate.rows[0]
      discount = parseFloat(coupon.discount_amount)
      totalAmount = Math.max(0, totalAmount - discount)
    }

    // create the order
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, totalAmount, discount, shippingAddress, 'pending']
    )

    const order = orderResult.rows[0]

    // insert order items and decrement stock atomically
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, item.productId, item.product.name, item.product.price, item.quantity, item.product.price]
      )

      const stockUpdate = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock',
        [item.quantity, item.productId]
      )

      if (stockUpdate.rows.length === 0) {
        // insufficient stock at commit time — rollback and report
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Insufficient stock for ${item.product.name}` })
      }
    }

    await client.query('COMMIT')

    return res.status(201).json({
      message: 'Order placed successfully',
      order,
      discount,
    })
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK')
      } catch (rbErr) {
        console.error('rollback error:', rbErr.message)
      }
    }
    console.error('checkout error:', err.message)
    return res.status(500).json({ error: 'Checkout failed' })
  } finally {
    if (client) client.release()
  }
}

module.exports = { checkout }
