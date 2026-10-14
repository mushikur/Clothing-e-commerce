import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../utils/app-error.js'

export function validate(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse({ body: request.body ?? {}, params: request.params ?? {}, query: request.query ?? {} })
    if (!result.success) {
      next(new AppError(422, 'validation_error', 'Request validation failed', result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))))
      return
    }
    request.validated = result.data
    next()
  }
}
