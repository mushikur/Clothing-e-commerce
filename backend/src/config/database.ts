import mongoose from 'mongoose'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI, { maxPoolSize: 20, minPoolSize: 2, serverSelectionTimeoutMS: 10_000 })
  logger.info({ database: mongoose.connection.name }, 'MongoDB connected')
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}
