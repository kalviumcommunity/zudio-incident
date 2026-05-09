const pool = require('../db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { sendError, sendSuccess } = require('../utils/api-response')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-123'
const SALT_ROUNDS = 12

const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body

    if (!name || !email || !password) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Name, email and password are required')
    }

    // check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      return sendError(res, 409, 'CONFLICT', 'Email already registered')
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

    const result = await pool.query(
      'INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, created_at',
      [name, email, hashedPassword, phone || null]
    )

    const user = result.rows[0]

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    })

    return sendSuccess(res, 201, {
      message: 'Registration successful',
      token,
      user,
    })
  } catch (err) {
    console.error('register error:', err.message)
    return sendError(res, 500, 'REGISTRATION_FAILED', 'Registration failed')
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Email and password are required')
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])

    if (result.rows.length === 0) {
      return sendError(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')
    }

    const user = result.rows[0]

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (!passwordMatches) {
      return sendError(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials')
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    })

    return sendSuccess(res, 200, {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
  } catch (err) {
    console.error('login error:', err.message)
    return sendError(res, 500, 'LOGIN_FAILED', 'Login failed')
  }
}

module.exports = { register, login }
