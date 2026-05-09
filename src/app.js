const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { sendError } = require('./utils/api-response')

dotenv.config()

const productRoutes = require('./routes/product.routes')
const authRoutes = require('./routes/auth.routes')
const orderRoutes = require('./routes/order.routes')
const cartRoutes = require('./routes/cart.routes')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  req._startTime = Date.now()
  req._queryCount = 0
  global.currentRequest = req

  res.on('finish', () => {
    const duration = Date.now() - req._startTime
    console.log(`[PROFILE] ${req.method} ${req.path} → ${duration}ms | ${req._queryCount} queries`)

    if (global.currentRequest === req) {
      global.currentRequest = null
    }
  })

  next()
})

// routes
app.use('/api/products', productRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/cart', cartRoutes)

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() })
})

// catch-all for 404s
app.use((req, res) => {
  return sendError(res, 404, 'NOT_FOUND', 'Route not found')
})

// basic error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Something went wrong')
})

module.exports = app
