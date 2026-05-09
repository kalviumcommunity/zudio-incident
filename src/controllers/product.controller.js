const pool = require('../db')
const { sendError, sendSuccess } = require('../utils/api-response')

// get all products with optional category filter and search
const getProducts = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query
    const parsedLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 20, 100))
    const parsedOffset = Math.max(0, Number.parseInt(offset, 10) || 0)

    let result

    if (search) {
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.name ILIKE $1 ORDER BY p.created_at DESC LIMIT $2 OFFSET $3',
        [`%${search}%`, parsedLimit, parsedOffset]
      )
    } else if (category) {
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE c.name = $1 LIMIT $2 OFFSET $3',
        [category, parsedLimit, parsedOffset]
      )
    } else {
      result = await pool.query(
        'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2',
        [parsedLimit, parsedOffset]
      )
    }

    return sendSuccess(res, 200, {
      products: result.rows,
      count: result.rows.length,
    })
  } catch (err) {
    console.error('getProducts error:', err.message)
    return sendError(res, 500, 'PRODUCT_LIST_FAILED', 'Failed to fetch products')
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
      return sendError(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found')
    }

    return sendSuccess(res, 200, { product: result.rows[0] })
  } catch (err) {
    console.error('getProductById error:', err.message)
    return sendError(res, 500, 'PRODUCT_FETCH_FAILED', 'Failed to fetch product')
  }
}

module.exports = { getProducts, getProductById }
