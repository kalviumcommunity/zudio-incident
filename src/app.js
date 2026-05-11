const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

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
  const startTime = Date.now()
  req._queryCount = 0
  global.__currentRequest = req

  res.on('finish', () => {
    if (global.__currentRequest === req) {
      global.__currentRequest = null
    }

    const duration = Date.now() - startTime
    console.log(`[PROFILE] ${req.method} ${req.originalUrl} -> ${duration}ms | ${req._queryCount} queries`)
  })

  res.on('close', () => {
    if (global.__currentRequest === req) {
      global.__currentRequest = null
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// catch-all for 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// basic error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong' })
})

module.exports = app
