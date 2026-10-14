import type { ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import { AppError } from '../utils/app-error.js'
import { logger } from '../utils/logger.js'
import { env } from '../config/env.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  let normalized = error instanceof AppError ? error : undefined
  if (!normalized && error instanceof ZodError) normalized = new AppError(422, 'validation_error', 'Request validation failed', error.issues)
  if (!normalized && error instanceof mongoose.Error.ValidationError) normalized = new AppError(422, 'model_validation_error', 'Data validation failed', Object.values(error.errors).map((item) => ({ path: item.path, message: 'Invalid value' })))
  if (!normalized && error instanceof mongoose.Error.CastError) normalized = new AppError(400, 'invalid_identifier', 'A supplied identifier is invalid')
  if (!normalized && error instanceof mongoose.Error.VersionError) normalized = new AppError(409, 'concurrent_update', 'The record changed during this request. Refresh and retry.')
  if (!normalized && typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) normalized = new AppError(409, 'duplicate_record', 'A record with these details already exists')
  if (!normalized && error instanceof jwt.JsonWebTokenError) normalized = new AppError(401, 'invalid_token', 'The supplied token is invalid or expired')
  if (!normalized && typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 500) normalized = new AppError(error.status, 'invalid_request', 'The request could not be processed')
  normalized ??= new AppError(500, 'internal_error', 'An unexpected error occurred')

  const duplicateFields = typeof error === 'object' && error !== null && 'code' in error && error.code === 11000 && 'keyPattern' in error && typeof error.keyPattern === 'object' && error.keyPattern !== null
    ? Object.keys(error.keyPattern)
    : undefined
  const logFields = { requestId: request.requestId, method: request.method, path: request.path, code: normalized.code, ...(duplicateFields?.length ? { duplicateFields } : {}) }
  if (normalized.statusCode >= 500) logger.error({ ...logFields, err: error }, normalized.message)
  else logger.warn(logFields, normalized.message)

  response.status(normalized.statusCode).json({
    success: false,
    error: { code: normalized.code, message: normalized.message, ...(normalized.details !== undefined ? { details: normalized.details } : {}) },
    requestId: request.requestId,
    ...(env.NODE_ENV === 'development' && normalized.statusCode >= 500 && error instanceof Error ? { debug: { name: error.name } } : {}),
  })
}
