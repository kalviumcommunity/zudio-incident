const pool = require('../db')

const checkout = async (req, res) => {
  const client = await pool.connect()

  try {
    const userId = req.user.userId
    const { items, couponCode, shippingAddress } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty'
      })
    }

    if (!shippingAddress) {
      return res.status(400).json({
        error: 'Shipping address is required'
      })
    }

    // =========================
    // START TRANSACTION
    // =========================

    await client.query('BEGIN')

    let totalAmount = 0
    const cartItems = []

    // =========================
    // FETCH PRODUCTS + VALIDATE STOCK
    // =========================

    for (const item of items) {
      const productResult = await client.query(
        `SELECT id, name, price, stock
         FROM products
         WHERE id = $1`,
        [item.productId]
      )

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK')

        return res.status(404).json({
          error: `Product ${item.productId} not found`
        })
      }

      const product = productResult.rows[0]

      if (product.stock < item.quantity) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error: `Insufficient stock for ${product.name}`
        })
      }

      totalAmount += parseFloat(product.price) * item.quantity

      cartItems.push({
        ...item,
        product
      })
    }

    let discount = 0

    // =========================
    // ATOMIC COUPON UPDATE
    // =========================

    if (couponCode) {
      const couponResult = await client.query(
        `UPDATE coupons
         SET used = true
         WHERE code = $1
         AND used = false
         AND expires_at > NOW()
         RETURNING *`,
        [couponCode]
      )

      if (couponResult.rows.length === 0) {
        await client.query('ROLLBACK')

        return res.status(400).json({
          error: 'Invalid or already used coupon'
        })
      }

      const coupon = couponResult.rows[0]

      discount = parseFloat(coupon.discount_amount)

      totalAmount = Math.max(
        0,
        totalAmount - discount
      )
    }

    // =========================
    // CREATE ORDER
    // =========================

    const orderResult = await client.query(
      `INSERT INTO orders
       (user_id, total_amount, discount, shipping_address, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        totalAmount,
        discount,
        shippingAddress,
        'pending'
      ]
    )

    const order = orderResult.rows[0]

    // =========================
    // INSERT ORDER ITEMS
    // =========================

    for (const item of cartItems) {
      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, product_name,
          product_price, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.productId,
          item.product.name,
          item.product.price,
          item.quantity,
          item.product.price
        ]
      )
    }

    // =========================
    // DECREMENT STOCK SAFELY
    // =========================

    for (const item of cartItems) {
      const stockUpdate = await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2
         AND stock >= $1
         RETURNING id`,
        [
          item.quantity,
          item.productId
        ]
      )

      if (stockUpdate.rows.length === 0) {
        await client.query('ROLLBACK')

        return res.status(409).json({
          error: `Insufficient stock for product ${item.productId}`
        })
      }
    }

    // =========================
    // COMMIT TRANSACTION
    // =========================

    await client.query('COMMIT')

    res.status(201).json({
      message: 'Order placed successfully',
      order,
      discount
    })

  } catch (err) {
    // =========================
    // ROLLBACK ON FAILURE
    // =========================

    await client.query('ROLLBACK')

    console.error('checkout error:', err.message)

    res.status(500).json({
      error: 'Checkout failed'
    })

  } finally {
    client.release()
  }
}

module.exports = {
  checkout
}