import type { RequestHandler } from 'express'
import { AppError } from '../utils/app-error.js'

export const notFound: RequestHandler = (request, _response, next) => next(new AppError(404, 'route_not_found', `No route matches ${request.method} ${request.path}`))
