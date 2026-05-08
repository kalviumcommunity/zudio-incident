const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // max connections — keep this low for now, we'll tune later
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

// Wrap pool.query to count queries per request (used by profiling middleware)
const _originalQuery = pool.query.bind(pool)
pool.query = (text, params) => {
  try {
    if (global.currentRequest && typeof global.currentRequest._queryCount === 'number') {
      global.currentRequest._queryCount++
    }
  } catch (e) {
    // noop - profiling must never break DB calls
  }
  return _originalQuery(text, params)
}

module.exports = pool
