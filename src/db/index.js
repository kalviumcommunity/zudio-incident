const sqlite3 = require('sqlite3').verbose()
const dotenv = require('dotenv')

dotenv.config()

// Use in-memory DB or file-based (defaults to zudio.db)
const dbPath = process.env.DATABASE_URL || 'zudio.db'

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err.message)
  } else {
    console.log('Connected to SQLite database:', dbPath)
  }
})

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON')

// Wrapper to convert callback-based sqlite3 to promise-based API matching pg.query signature
const pool = {
  query: (text, params = []) => {
    return new Promise((resolve, reject) => {
      // Count query for profiling
      try {
        if (global._currentRequest) global._currentRequest._queryCount++
      } catch (e) {
        // ignore
      }

      // Determine if SELECT, INSERT, UPDATE, DELETE
      const trimmed = text.trim().toUpperCase()
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
        db.all(text, params, (err, rows) => {
          if (err) reject(err)
          else resolve({ rows: rows || [] })
        })
      } else {
        // INSERT, UPDATE, DELETE
        db.run(text, params, function (err) {
          if (err) reject(err)
          else {
            // For INSERT, return the new row ID; for UPDATE/DELETE use changes()
            resolve({
              rows: this.lastID ? [{ id: this.lastID }] : [],
              rowCount: this.changes,
            })
          }
        })
      }
    })
  },
  connect: () => {
    // SQLite doesn't use connection pool, return a mock client for transaction support
    return Promise.resolve({
      query: pool.query,
      release: () => Promise.resolve(),
    })
  },
}

module.exports = pool
