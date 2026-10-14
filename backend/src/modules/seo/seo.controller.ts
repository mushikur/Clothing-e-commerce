import type { Request, Response } from 'express'
import { Category } from '../../models/Category.js'
import { ContentPage } from '../../models/ContentPage.js'
import { LandingPage } from '../../models/LandingPage.js'
import { Product } from '../../models/Product.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { env } from '../../config/env.js'
import { asyncHandler } from '../../utils/async-handler.js'

const sitemapPageSize = 10_000
const xml = (value: unknown) => String(value ?? '').replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '\"': '&quot;' })[character]!)
function business(request: Request) {
  if (!request.business) throw new Error('Business context is required for sitemap generation')
  return request.business
}
function storefrontOrigin(request: Request) {
  const tenant = business(request)
  const requestedHost = request.get('host')?.split(':')[0]?.toLowerCase().replace(/^www\./, '')
  const registeredHost = tenant.domains.find((domain: string) => domain.toLowerCase().replace(/^www\./, '') === requestedHost)
  if (registeredHost && !['localhost', '127.0.0.1'].includes(registeredHost)) return `https://${registeredHost.replace(/^www\./, '')}`
  return new URL(env.FRONTEND_URL).origin
}
function sendXml(response: Response, body: string, type = 'application/xml') {
  response.setHeader('Content-Type', `${type}; charset=utf-8`)
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  response.send(body)
}
function urlEntry(origin: string, path: string, lastmod?: Date) {
  return `<url><loc>${xml(origin + path)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}</url>`
}

export const sitemapIndexController = asyncHandler(async (request, response) => {
  const tenant = business(request)
  const origin = storefrontOrigin(request)
  const [productCount, settingsResult] = await Promise.all([
    Product.countDocuments({ businessId: tenant._id, status: 'published' }),
    WebsiteSettings.findOne({ businessId: tenant._id }).select('updatedAt').lean(),
  ])
  const settings = settingsResult as { updatedAt?: Date } | null
  const productPages = Math.ceil(productCount / sitemapPageSize)
  const maps = [`<sitemap><loc>${xml(`${origin}/sitemap-pages.xml`)}</loc>${settings?.updatedAt ? `<lastmod>${settings.updatedAt.toISOString()}</lastmod>` : ''}</sitemap>`]
  for (let page = 0; page < productPages; page += 1) maps.push(`<sitemap><loc>${xml(`${origin}/sitemap-products/${page}.xml`)}</loc></sitemap>`)
  sendXml(response, `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.join('')}</sitemapindex>`)
})

export const sitemapPagesController = asyncHandler(async (request, response) => {
  const tenant = business(request)
  const origin = storefrontOrigin(request)
  const [categories, landingPages, contentPages] = await Promise.all([
    Category.find({ businessId: tenant._id, status: 'active' }).select('slug updatedAt').sort({ slug: 1 }).lean(),
    LandingPage.find({ businessId: tenant._id, status: 'published' }).select('slug updatedAt').sort({ slug: 1 }).lean(),
    ContentPage.find({ businessId: tenant._id, status: 'published' }).select('slug updatedAt').sort({ slug: 1 }).lean(),
  ])
  const entries = [urlEntry(origin, '/'), urlEntry(origin, '/shop'), ...categories.map((item) => urlEntry(origin, `/category/${encodeURIComponent(item.slug)}`, item.updatedAt)), ...landingPages.map((item) => urlEntry(origin, `/${encodeURIComponent(item.slug)}`, item.updatedAt)), ...contentPages.map((item) => urlEntry(origin, `/${encodeURIComponent(item.slug)}`, item.updatedAt))]
  sendXml(response, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`)
})

export const sitemapProductsController = asyncHandler(async (request, response) => {
  const tenant = business(request)
  const page = Number(request.params.page)
  if (!Number.isSafeInteger(page) || page < 0) { response.status(404).end(); return }
  const products = await Product.find({ businessId: tenant._id, status: 'published' }).select('slug updatedAt').sort({ _id: 1 }).skip(page * sitemapPageSize).limit(sitemapPageSize).lean()
  const entries = products.map((item) => urlEntry(storefrontOrigin(request), `/products/${encodeURIComponent(item.slug)}`, item.updatedAt))
  sendXml(response, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</urlset>`)
})

export const robotsController = asyncHandler(async (request, response) => {
  const origin = storefrontOrigin(request)
  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
  response.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /cart\nDisallow: /checkout\nDisallow: /wishlist\nDisallow: /orders\nDisallow: /tracking\nSitemap: ${origin}/sitemap.xml\n`)
})
