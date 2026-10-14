import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireBusiness } from '../../middleware/require-business.js'
import { env } from '../../config/env.js'
import { robotsController, sitemapIndexController, sitemapPagesController, sitemapProductsController } from './seo.controller.js'

export const seoRoutes = Router()
const seoRateLimit = rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: Math.min(env.RATE_LIMIT_MAX, 120), standardHeaders: 'draft-7', legacyHeaders: false })
seoRoutes.get('/robots.txt', seoRateLimit, requireBusiness, robotsController)
seoRoutes.get('/sitemap.xml', seoRateLimit, requireBusiness, sitemapIndexController)
seoRoutes.get('/sitemap-pages.xml', seoRateLimit, requireBusiness, sitemapPagesController)
seoRoutes.get('/sitemap-products/:page.xml', seoRateLimit, requireBusiness, sitemapProductsController)
