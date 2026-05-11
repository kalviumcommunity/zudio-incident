const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
require('dotenv').config()

const sqlFile = path.join(__dirname, '..', 'src', 'migrations', '001_create_tables_sqlite.sql')
const sql = fs.readFileSync(sqlFile, 'utf8')

const dbPath = process.env.DATABASE_URL || 'zudio.db'

;(async () => {
  const db = new sqlite3.Database(dbPath)

  db.exec(sql, (err) => {
    if (err) {
      console.error('Migration failed:', err.message)
      db.close()
      process.exit(1)
    } else {
      console.log('Migrations applied successfully.')
      db.close()
      process.exit(0)
    }
  })
})()
