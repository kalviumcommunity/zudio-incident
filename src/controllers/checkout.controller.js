const pool = require('../db')
const { sendError, sendSuccess } = require('../utils/api-response')

const checkout = async (req, res) => {
  const client = await pool.connect()

  const rollbackAndRespond = async (statusCode, payload) => {
    await client.query('ROLLBACK')
    return sendError(res, statusCode, payload.error.code, payload.error.message, payload.error.details)
  }

  try {
    const userId = req.user.userId
    const { items, couponCode, shippingAddress } = req.body

    // items should be an array of { productId, quantity }
    if (!items || items.length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Cart is empty')
    }

    if (!shippingAddress) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Shipping address is required')
    }

    await client.query('BEGIN')

    const normalizedItems = new Map()

    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        await client.query('ROLLBACK')
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid cart item quantity')
      }

      const currentQuantity = normalizedItems.get(item.productId) || 0
      normalizedItems.set(item.productId, currentQuantity + item.quantity)
    }

    const productIds = Array.from(normalizedItems.keys())
    const productResult = await client.query(
      'SELECT id, name, price, stock FROM products WHERE id = ANY($1::int[]) FOR UPDATE',
      [productIds]
    )

    if (productResult.rows.length !== productIds.length) {
      const foundProductIds = new Set(productResult.rows.map((product) => product.id))
      const missingProductId = productIds.find((productId) => !foundProductIds.has(productId))

      return rollbackAndRespond(404, {
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `Product ${missingProductId} not found`,
        },
      })
    }

    const productsById = new Map(productResult.rows.map((product) => [product.id, product]))

    let totalAmount = 0
    const cartItems = []

    for (const [productId, quantity] of normalizedItems.entries()) {
      const product = productsById.get(productId)

      if (product.stock < quantity) {
        return rollbackAndRespond(400, {
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${product.name}`,
          },
        })
      }

      totalAmount += parseFloat(product.price) * quantity
      cartItems.push({ productId, quantity, product })
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
        return sendError(res, 400, 'COUPON_INVALID', 'Invalid or expired coupon')
      }

      const coupon = couponResult.rows[0]

      if (coupon.used || new Date(coupon.expires_at) <= new Date()) {
        await client.query('ROLLBACK')
        return sendError(res, 400, 'COUPON_INVALID', 'Invalid or expired coupon')
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
        'INSERT INTO order_items (order_id, product_id, unit_price_at_purchase, quantity) VALUES ($1, $2, $3, $4)',
        [order.id, item.productId, item.product.price, item.quantity]
      )
    }

    for (const item of cartItems) {
      const stockUpdate = await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id, stock',
        [item.quantity, item.productId]
      )

      if (stockUpdate.rows.length === 0) {
        await client.query('ROLLBACK')
        return sendError(res, 400, 'INSUFFICIENT_STOCK', `Insufficient stock for ${item.product.name}`)
      }
    }

    await client.query('COMMIT')

    return sendSuccess(res, 201, {
      message: 'Order placed successfully',
      order,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceAtPurchase: item.product.price,
      })),
      discount,
    })
  } catch (err) {
    console.error('checkout error:', err.message)
    await client.query('ROLLBACK')
    return sendError(res, 500, 'CHECKOUT_FAILED', 'Checkout failed')
  } finally {
    client.release()
  }
}

module.exports = { checkout }
