const pool = require('../db')

const checkout = async (req, res) => {
  const client = await pool.connect()
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

    // FIXED: Use dedicated client for transaction
    await client.query('BEGIN')

    // calculate total price by fetching each product
    let totalAmount = 0
    const cartItems = []

    for (const item of items) {
      // FIXED: Lock rows for stock check inside transaction
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
    let order

    // BUG: [HIGH] Double Discount (Race Condition) — coupon check and mark-as-used are not atomic.
    // Two concurrent requests can both pass the check before either marks it as used.
    // Result: Coupon SAVE50 used 400 times instead of 50.
    // Fix: Use atomic UPDATE coupon SET used = true WHERE used = false RETURNING *
    if (couponCode) {
      // FIXED: Use atomic UPDATE ... WHERE ... RETURNING to check and mark as used in one operation
      const couponResult = await client.query(
        'UPDATE coupons SET used = true WHERE code = $1 AND used = false AND expires_at > NOW() RETURNING *',
        [couponCode]
      )

      if (couponResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }

      const coupon = couponResult.rows[0]
      discount = parseFloat(coupon.discount_amount)
      totalAmount = Math.max(0, totalAmount - discount)

      // create the order
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, totalAmount, discount, shippingAddress, 'pending']
      )

      order = orderResult.rows[0]
    } else {
      // no coupon — just create the order
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, totalAmount, 0, shippingAddress, 'pending']
      )

      order = orderResult.rows[0]
    }

    // insert order items (same for both coupon and non-coupon paths)
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, item.productId, item.product.name, item.product.price, item.quantity, item.product.price]
      )
    }

    // BUG: [CRITICAL] Stock Decrement Missing — stock is never decremented after purchase.
    // Result: 3 products with negative stock reported. Overselling and inventory chaos.
    // Fix: Wrap stock decrement in same transaction as order insert. Add CHECK constraint.
    // FIXED: Uncommented and now inside transaction
    for (const item of cartItems) {
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.quantity, item.productId]
      )
    }

    await client.query('COMMIT')

    if (couponCode) {
      return res.status(201).json({
        message: 'Order placed successfully',
        order,
        discount,
      })
    } else {
      return res.status(201).json({
        message: 'Order placed successfully',
        order,
      })
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      // ignore rollback errors
    }
    console.error('checkout error:', err.message)
    res.status(500).json({ error: 'Checkout failed' })
  } finally {
    client.release()
  }
}

module.exports = { checkout }
