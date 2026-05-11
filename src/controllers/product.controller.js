const pool = require('../db')
const { getRedisClient } = require('../cache/redis')

const CACHE_TTL_SECONDS = 300

const buildProductsQuery = (category, search, limit, offset) => {
  if (search) {
    return {
      text: 'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.name ILIKE $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3',
      values: [`%${search}%`, limit, offset],
    }
  }

  if (category) {
    return {
      text: 'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE c.name = $1 LIMIT $2 OFFSET $3',
      values: [category, limit, offset],
    }
  }

  return {
    text: 'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2',
    values: [limit, offset],
  }
}

// get all products with optional category filter and search
const getProducts = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query
    const parsedLimit = parseInt(limit)
    const parsedOffset = parseInt(offset)

    const queryConfig = buildProductsQuery(category, search, parsedLimit, parsedOffset)
    const cacheKey = `products:${JSON.stringify({
      category: category || null,
      search: search || null,
      limit: parsedLimit,
      offset: parsedOffset,
    })}`

    const redisClient = await getRedisClient()

    if (redisClient) {
      const cached = await redisClient.get(cacheKey)
      if (cached) {
        res.set('X-Cache', 'HIT')
        return res.json(JSON.parse(cached))
      }
    }

    const result = await pool.query(queryConfig.text, queryConfig.values)

    const payload = {
      products: result.rows,
      count: result.rows.length,
    }

    if (redisClient) {
      await redisClient.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(payload))
      res.set('X-Cache', 'MISS')
    } else {
      res.set('X-Cache', 'BYPASS')
    }

    res.json(payload)
  } catch (err) {
    console.error('getProducts error:', err.message)
    res.status(500).json({ error: 'Failed to fetch products' })
  }
}

// get single product by id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('getProductById error:', err.message)
    res.status(500).json({ error: 'Failed to fetch product' })
  }
}

module.exports = { getProducts, getProductById }
