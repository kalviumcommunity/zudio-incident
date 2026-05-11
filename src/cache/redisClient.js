const redis = require('redis')

const url = process.env.REDIS_URL || 'redis://localhost:6379'
const client = redis.createClient({ url })

client.on('error', (err) => console.error('Redis Client Error', err))

(async () => {
  try {
    await client.connect()
    console.log('Redis connected')
  } catch (e) {
    console.error('Redis connection failed', e)
  }
})()

const get = async (key) => {
  try {
    const v = await client.get(key)
    return v ? JSON.parse(v) : null
  } catch (e) {
    console.error('Redis get error', e)
    return null
  }
}

const set = async (key, value, ttlSeconds = 300) => {
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds })
  } catch (e) {
    console.error('Redis set error', e)
  }
}

module.exports = { get, set }
