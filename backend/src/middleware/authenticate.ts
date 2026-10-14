import type { RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/async-handler.js'

type AccessClaims = JwtPayload & { businessId: string; role: 'customer' | 'staff' | 'manager' | 'admin' | 'super_admin'; tokenUse: 'access' }

export const authenticate: RequestHandler = asyncHandler(async (request, _response, next) => {
  const [scheme, token] = (request.get('authorization') ?? '').split(' ')
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'authentication_required', 'A valid access token is required')

  let claims: AccessClaims
  try {
    const business = request.business
    if (!business) throw new Error('business context is missing')
    const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET, { issuer: 'fashion-commerce-api', audience: business.id })
    if (typeof decoded === 'string' || decoded.tokenUse !== 'access' || !decoded.sub || !decoded.businessId || !decoded.role) throw new Error('invalid access claims')
    claims = decoded as AccessClaims
  } catch {
    throw new AppError(401, 'invalid_access_token', 'Access token is invalid or expired')
  }

  const business = request.business
  if (!business || business.id !== claims.businessId) throw new AppError(403, 'business_scope_mismatch', 'Access token is not valid for this storefront')
  const user = await User.findOne({ _id: claims.sub, businessId: business._id, status: 'active' }).select('_id role')
  if (!user || user.role !== claims.role) throw new AppError(401, 'invalid_access_token', 'Access token is no longer valid')
  request.user = { id: user.id, businessId: business.id, role: user.role }
  next()
})
