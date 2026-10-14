import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { AppError } from './utils/app-error.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { requestContext } from './middleware/request-context.js'
import { apiRateLimit } from './middleware/rate-limits.js'
import { notFound } from './middleware/not-found.js'
import { errorHandler } from './middleware/error-handler.js'
import { apiRoutes } from './routes/index.js'
import { seoRoutes } from './modules/seo/seo.routes.js'
import { localMediaDirectory } from './modules/media/storage-provider.js'
import './models/index.js'

const proxyTrust = env.TRUST_PROXY === 'true' ? 1 : env.TRUST_PROXY === 'false' ? false : Number(env.TRUST_PROXY)
export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', Number.isFinite(proxyTrust) ? proxyTrust : false)
app.use(requestContext)
app.use(pinoHttp({
  logger,
  genReqId: (request) => request.requestId,
  serializers: { req: (request) => ({ method: request.method, url: request.url?.split('?')[0] }) },
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
}))
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'", 'https:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", new URL(env.FRONTEND_URL).origin, new URL(env.API_PUBLIC_URL).origin, ...env.CORS_ORIGINS],
      ...(env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
    },
  },
}))
app.use(cors({
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id', 'X-Guest-Order-Token', env.TENANT_HEADER],
  origin(origin, callback) {
    if (!origin || env.CORS_ORIGINS.includes(origin)) { callback(null, true); return }
    callback(new AppError(403, 'cors_origin_denied', 'This origin is not allowed'))
  },
}))
app.use(express.json({ limit: '1mb', strict: true }))
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }))
app.use(cookieParser())
app.get('/health/live', (_request, response) => response.status(200).json({ success: true, data: { status: 'ok' } }))
if (localMediaDirectory) app.use('/media', (_request, response, next) => { response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next() }, express.static(localMediaDirectory, { dotfiles: 'deny', index: false, fallthrough: true, maxAge: '1h', setHeaders(response) { response.setHeader('X-Content-Type-Options', 'nosniff') } }))
app.use(seoRoutes)
app.use(env.API_PREFIX, apiRateLimit, apiRoutes)
app.use(notFound)
app.use(errorHandler)
