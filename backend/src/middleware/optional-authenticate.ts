import type { RequestHandler } from 'express'
import { authenticate } from './authenticate.js'

export const optionalAuthenticate: RequestHandler = (request, response, next) => {
  if (!request.get('authorization')) { next(); return }
  authenticate(request, response, next)
}
