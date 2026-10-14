import type { RequestHandler } from 'express'
import { Business } from '../models/Business.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'

function requestHost(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined
  return hostHeader.split(':')[0]?.trim().toLowerCase().replace(/^www\./, '') || undefined
}

export const requireBusiness: RequestHandler = asyncHandler(async (request, response, next) => {
  const requestedSlug = request.get(env.TENANT_HEADER)?.trim().toLowerCase()
  const host = requestHost(request.get('host'))
  let business = host ? await Business.findOne({ domains: host, status: 'active' }) : null
  if (!business && requestedSlug) business = await Business.findOne({ slug: requestedSlug, status: 'active' })
  if (!business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  if (requestedSlug && requestedSlug !== business.slug) throw new AppError(400, 'business_scope_mismatch', 'Business header does not match the requested storefront')
  request.business = business
  response.vary('Host')
  response.vary(env.TENANT_HEADER)
  next()
})
