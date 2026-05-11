#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { Client } = require('pg')

dotenv.config()

async function main() {
  const sqlFile = process.argv[2]

  if (!sqlFile) {
    console.error('Usage: node scripts/run_sql.js <sql-file>')
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to .env before running migrations or seed data.')
    process.exit(1)
  }

  const filePath = path.resolve(process.cwd(), sqlFile)
  const sql = fs.readFileSync(filePath, 'utf8')

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    await client.query(sql)
    console.log(`Executed ${path.relative(process.cwd(), filePath)}`)
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Could not connect to PostgreSQL at the DATABASE_URL in .env.')
      console.error('Start your PostgreSQL server or point DATABASE_URL to a reachable instance, then rerun the command.')
    } else {
      console.error(error.message)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})