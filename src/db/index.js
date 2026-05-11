const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // connection settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

// ===============================
// QUERY PROFILING + QUERY COUNTER
// ===============================

const originalQuery = pool.query.bind(pool)

let queryCount = 0

pool.query = (...args) => {
  queryCount++

  console.log(`Query #${queryCount}:`, args[0])

  return originalQuery(...args)
}

pool.getQueryCount = () => queryCount

pool.resetQueryCount = () => {
  queryCount = 0
}

module.exports = pool