import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'

export const verifyBrowserOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get('origin')
  if (!origin) return next(new AppError(403, 'origin_required', 'A trusted browser origin is required for this session request'))
  let originUrl: URL
  try { originUrl = new URL(origin) } catch { return next(new AppError(403, 'origin_denied', 'This browser origin is not allowed')) }
  if (!['http:', 'https:'].includes(originUrl.protocol)) return next(new AppError(403, 'origin_denied', 'This browser origin is not allowed'))
  const requestHost = request.get('host')?.toLowerCase().split(':')[0]?.replace(/^www\./, '')
  const originHost = originUrl.hostname.toLowerCase().replace(/^www\./, '')
  const sameOrigin = requestHost === originUrl.host.toLowerCase().split(':')[0]
  const configuredOrigin = env.CORS_ORIGINS.some((value) => {
    try { return new URL(value).origin === originUrl.origin } catch { return false }
  })
  const tenantDomain = request.business?.domains.some((domain: string) => domain.toLowerCase().replace(/^www\./, '') === originHost)
  if (!sameOrigin && !configuredOrigin && !tenantDomain) return next(new AppError(403, 'origin_denied', 'This browser origin is not allowed'))
  next()
}
