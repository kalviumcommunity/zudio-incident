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

const originalQuery = pool.query.bind(pool)
pool.query = (...args) => {
  if (global.__currentRequest) {
    global.__currentRequest._queryCount = (global.__currentRequest._queryCount || 0) + 1
  }

  return originalQuery(...args)
}

pool.on('connect', (client) => {
  if (client.__queryCountingWrapped) {
    return
  }

  client.__queryCountingWrapped = true
  const originalClientQuery = client.query.bind(client)

  client.query = (...queryArgs) => {
    if (global.__currentRequest) {
      global.__currentRequest._queryCount = (global.__currentRequest._queryCount || 0) + 1
    }

    return originalClientQuery(...queryArgs)
  }
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

module.exports = pool
