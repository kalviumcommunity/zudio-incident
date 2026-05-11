const app = require('./app')
const chalk = require('chalk').default

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.clear()

  console.log(
    chalk.cyan.bold(`
╔══════════════════════════════════════╗
║        ZUDIO INCIDENT API           ║
║   Production Refactor - Part A      ║
╚══════════════════════════════════════╝
`)
  )

  console.log(
    chalk.green('✅ Server Status: RUNNING')
  )

  console.log(
    chalk.blue(`🌐 API URL: http://localhost:${PORT}`)
  )

  console.log(
    chalk.yellow(
      `⚙️ Environment: ${process.env.NODE_ENV || 'development'}`
    )
  )

  console.log(
    chalk.magenta('📊 Query Profiling: ENABLED')
  )

  console.log(
    chalk.cyan('🔒 Security Fixes: ACTIVE')
  )

  console.log(
    chalk.gray(
      `🕒 Started At: ${new Date().toLocaleString()}`
    )
  )

  console.log('\n')
})