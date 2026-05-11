const pool = require('../db')
const redis = require('redis')
// express-validator imported for request validation — TODO: wire up later
const { validationResult } = require('express-validator')

let redisClient = null

// Initialize Redis client
const initRedis = async () => {
  if (redisClient) return redisClient
  
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 50, 500),
    },
  })

  redisClient.on('error', (err) => console.error('Redis Client Error:', err))
  redisClient.on('connect', () => console.log('Redis connected'))
  
  try {
    await redisClient.connect()
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message)
    redisClient = null
  }

  return redisClient
}

// Initialize Redis on module load
initRedis()

const CACHE_TTL = 300 // 5 minutes in seconds

// get all products with optional category filter and search
const getProducts = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query
    
    // Validate pagination params
    const parsedLimit = Math.min(parseInt(limit) || 20, 100)
    const parsedOffset = Math.max(parseInt(offset) || 0, 0)

    // Generate cache key based on query parameters
    const cacheKey = `products:${search || ''}:${category || ''}:${parsedLimit}:${parsedOffset}`

    let result
    let cacheStatus = 'MISS'

    // Try to get from cache
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey)
        if (cached) {
          result = JSON.parse(cached)
          cacheStatus = 'HIT'
          res.set('X-Cache', 'HIT')
          return res.json({
            products: result,
            count: result.length,
            cacheStatus: 'HIT',
          })
        }
      } catch (cacheErr) {
        console.error('Redis GET error:', cacheErr.message)
        // Continue to DB on cache error
      }
    }

    // Cache miss — query database
    res.set('X-Cache', 'MISS')

    if (search) {
      // Parameterized search to prevent SQL injection (Part A Bug 1 fix)
      const searchPattern = `%${search}%`
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.name ILIKE $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3',
        [searchPattern, parsedLimit, parsedOffset]
      )
    } else if (category) {
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE c.name = $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3',
        [category, parsedLimit, parsedOffset]
      )
    } else {
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2',
        [parsedLimit, parsedOffset]
      )
    }

    // Store in cache
    if (redisClient) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result.rows))
      } catch (cacheErr) {
        console.error('Redis SET error:', cacheErr.message)
        // Continue despite cache error
      }
    }

    res.json({
      products: result.rows,
      count: result.rows.length,
      cacheStatus: 'MISS',
    })
  } catch (err) {
    console.error('getProducts error:', err.message)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
}

// get single product by id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params

    // Validate id
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        error: 'INVALID_PRODUCT_ID', 
        message: 'Product ID must be a positive integer',
        productId: id 
      })
    }

    const cacheKey = `product:${id}`
    let cacheStatus = 'MISS'

    // Try to get from cache
    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey)
        if (cached) {
          const product = JSON.parse(cached)
          res.set('X-Cache', 'HIT')
          return res.json({
            product,
            cacheStatus: 'HIT',
          })
        }
      } catch (cacheErr) {
        console.error('Redis GET error:', cacheErr.message)
      }
    }

    // Cache miss — query database
    res.set('X-Cache', 'MISS')

    const result = await pool.query(
      'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'PRODUCT_NOT_FOUND',
        message: 'Product with id ' + id + ' not found',
        productId: parseInt(id)
      })
    }

    const product = result.rows[0]

    // Store in cache
    if (redisClient) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(product))
      } catch (cacheErr) {
        console.error('Redis SET error:', cacheErr.message)
      }
    }

    res.json({
      product,
      cacheStatus: 'MISS',
    })
  } catch (err) {
    console.error('getProductById error:', err.message)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
}

module.exports = { getProducts, getProductById }

