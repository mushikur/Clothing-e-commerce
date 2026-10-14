import { Router } from 'express'
import mongoose from 'mongoose'
import { success } from '../utils/api-response.js'

export const healthRoutes = Router()
healthRoutes.get('/live', (_request, response) => success(response, { status: 'ok' }))
healthRoutes.get('/ready', (_request, response) => {
  const ready = mongoose.connection.readyState === 1
  if (!ready) { response.status(503).json({ success: false, error: { code: 'not_ready', message: 'Database connection is not ready' } }); return }
  success(response, { status: 'ready' })
})
