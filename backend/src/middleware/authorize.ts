import type { RequestHandler } from 'express'
import { AppError } from '../utils/app-error.js'

type Role = 'customer' | 'staff' | 'manager' | 'admin' | 'super_admin'
export function authorize(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) return next(new AppError(401, 'authentication_required', 'Sign in is required'))
    if (request.user.role !== 'super_admin' && !roles.includes(request.user.role)) return next(new AppError(403, 'permission_denied', 'You do not have permission to perform this action'))
    next()
  }
}
