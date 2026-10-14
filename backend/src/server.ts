import { createServer } from 'node:http'
import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { startMediaWorker } from './modules/media/media-worker.js'

async function start(): Promise<void> {
  await connectDatabase()
  const stopMediaWorker = startMediaWorker()
  const server = createServer(app)
  server.listen(env.PORT, env.HOST, () => logger.info({ host: env.HOST, port: env.PORT }, 'API server listening'))

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'Graceful shutdown started')
    server.close((error) => {
      if (error) { logger.error({ err: error }, 'HTTP server close failed'); process.exitCode = 1 }
      void stopMediaWorker().finally(() => disconnectDatabase().finally(() => { process.exit() }))
    })
    setTimeout(() => { logger.error('Graceful shutdown timed out'); process.exit(1) }, 15_000).unref()
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

void start().catch((error: unknown) => {
  logger.fatal({ err: error }, 'API startup failed')
  process.exitCode = 1
})
