const jwt = require('jsonwebtoken')
const pool = require('../db')
const { sendError } = require('../utils/api-response')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-123'

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'AUTH_TOKEN_MISSING', 'No token provided')
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    return sendError(res, 401, 'AUTH_TOKEN_INVALID', 'Invalid or expired token')
  }
}

// check if user has admin role — looks up from db each time
// TODO: maybe cache this, hitting db every request isn't great
const verifyAdmin = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return sendError(res, 401, 'AUTH_USER_NOT_FOUND', 'User not found')
    }

    if (result.rows[0].role !== 'admin') {
      return sendError(res, 403, 'AUTH_FORBIDDEN', 'Admin access required')
    }

    next()
  } catch (err) {
    console.error('verifyAdmin error:', err.message)
    return sendError(res, 500, 'AUTH_CHECK_FAILED', 'Authorization check failed')
  }
}

module.exports = { verifyToken, verifyAdmin }
