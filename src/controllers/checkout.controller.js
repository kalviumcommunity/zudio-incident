const pool = require('../db')

const checkout = async (req, res) => {
  const client = await pool.connect()

  const rollbackAndRespond = async (statusCode, payload) => {
    await client.query('ROLLBACK')
    return res.status(statusCode).json(payload)
  }

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

    await client.query('BEGIN')

    // calculate total price by fetching each product
    let totalAmount = 0
    const cartItems = []

    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid cart item quantity' })
      }

      const productResult = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1 FOR UPDATE',
        [item.productId]
      )

      if (productResult.rows.length === 0) {
        return rollbackAndRespond(404, { error: `Product ${item.productId} not found` })
      }

      const product = productResult.rows[0]

      if (product.stock < item.quantity) {
        return rollbackAndRespond(400, { error: `Insufficient stock for ${product.name}` })
      }

      totalAmount += parseFloat(product.price) * item.quantity
      cartItems.push({ ...item, product })
    }

    let discount = 0

    // validate and apply coupon if provided
    if (couponCode) {
      const couponResult = await client.query(
        'SELECT * FROM coupons WHERE code = $1 FOR UPDATE',
        [couponCode]
      )

      if (couponResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }

      const coupon = couponResult.rows[0]

      if (coupon.used || new Date(coupon.expires_at) <= new Date()) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }

      discount = parseFloat(coupon.discount_amount)
      totalAmount = Math.max(0, totalAmount - discount)

      await client.query('UPDATE coupons SET used = true WHERE id = $1', [coupon.id])
    }

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, totalAmount, discount, shippingAddress, 'pending']
    )

    const order = orderResult.rows[0]

    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, item.productId, item.product.name, item.product.price, item.quantity, item.product.price]
      )
    }

    for (const item of cartItems) {
      const stockUpdate = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id, stock',
        [item.quantity, item.productId]
      )

      if (stockUpdate.rows.length === 0) {
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
    console.error('checkout error:', err.message)
    await client.query('ROLLBACK')
    return res.status(500).json({ error: 'Checkout failed' })
  } finally {
    client.release()
  }
}

module.exports = { checkout }
