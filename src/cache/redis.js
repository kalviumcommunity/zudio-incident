const { createClient } = require('redis')

let redisClient = null
let connectPromise = null

const getRedisClient = async () => {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    return null
  }

  if (!redisClient) {
    redisClient = createClient({ url: redisUrl })
    redisClient.on('error', (err) => {
      console.error('Redis client error:', err.message)
    })
  }

  if (!redisClient.isOpen) {
    if (!connectPromise) {
      connectPromise = redisClient.connect().finally(() => {
        connectPromise = null
      })
    }

    try {
      await connectPromise
    } catch (err) {
      console.error('Redis connect failed:', err.message)
      return null
    }
  }

  return redisClient
}

module.exports = { getRedisClient }
