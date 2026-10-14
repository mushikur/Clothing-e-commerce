import type { Request } from 'express'
import type { Types } from 'mongoose'
import { variantData } from '../products/products.service.js'
import { ContentPage } from '../../models/ContentPage.js'
import { Category } from '../../models/Category.js'
import { HomepageSection } from '../../models/HomepageSection.js'
import { LandingPage } from '../../models/LandingPage.js'
import { Product } from '../../models/Product.js'
import { Theme } from '../../models/Theme.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function tenant(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business }
function plainContent(value: unknown): Record<string, any> { return value instanceof Map ? Object.fromEntries(value) : (value || {}) as Record<string, any> }

async function publicSections(businessId: Types.ObjectId, pageKey: string) {
  const now = new Date()
  const sections = await HomepageSection.find({ businessId, pageKey, visible: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] }] }).sort({ sortOrder: 1, createdAt: 1 }).limit(100).lean()
  const populated = await Promise.all(sections.map(async (section) => {
    const content = plainContent(section.content)
    const categoryIds = [...new Set([...(content.categoryIds || []), ...(content.categoryId ? [content.categoryId] : [])].map(String))]
    const productIds = [...new Set((content.productIds || []).map(String))]
    const [products, categories] = await Promise.all([
      productIds.length
        ? Product.find({ businessId, status: 'published', _id: { $in: productIds } }).select('name slug sku price discountPercent media translations shortDescription categoryId').populate('categoryId', 'name slug translations').lean()
        : categoryIds.length && ['product_grid', 'product_carousel', 'product_collection', 'collections'].includes(section.type)
          ? Product.find({ businessId, status: 'published', categoryId: { $in: categoryIds } }).sort({ publishedAt: -1 }).limit(Math.min(Number(content.limit) || 8, 24)).select('name slug sku price discountPercent media translations shortDescription categoryId').populate('categoryId', 'name slug translations').lean()
          : [],
      categoryIds.length ? Category.find({ businessId, status: 'active', _id: { $in: categoryIds } }).sort({ sortOrder: 1 }).select('name slug imageUrl translations').lean() : [],
    ])
    const orderedProducts = productIds.length ? productIds.map((id) => products.find((product) => String(product._id) === id)).filter(Boolean) : products
    return { ...section, content, products: orderedProducts, categories }
  }))
  const products = populated.flatMap((section) => section.products).filter((product): product is NonNullable<typeof product> => Boolean(product))
  const ids = [...new Map(products.map((product) => [String(product._id), product._id])).values()] as Types.ObjectId[]
  const variants = ids.length ? await variantData(businessId, ids) : []
  return populated.map((section) => ({ ...section, products: section.products.filter(Boolean).map((product) => ({ ...product, variants: variants.filter((variant) => String(variant.productId) === String(product!._id)) })) }))
}

export const storefrontConfigController = asyncHandler(async (request, response) => {
  const business = tenant(request)
  const [settings, theme] = await Promise.all([
    WebsiteSettings.findOne({ businessId: business._id }).select('displayName logoUrl faviconUrl contact socialLinks seo locale currency defaultLanguage enabledLocales defaultThemeId mediaOptimization.lazyLoading').lean(),
    Theme.findOne({ businessId: business._id, status: 'published' }).sort({ publishedAt: -1 }).select('name preset colors typography components').lean(),
  ]) as [{ displayName?: string; currency?: string; locale?: string; logoUrl?: string; faviconUrl?: string; contact?: Record<string, string>; socialLinks?: Array<{ platform: string; url: string }>; seo?: Record<string, string>; mediaOptimization?: { lazyLoading?: boolean } } | null, { preset?: string; colors?: Record<string, string>; typography?: { displayFont: string; bodyFont: string }; components?: Record<string, string> } | null]
  success(response, {
    business: { name: settings?.displayName || business.name, currency: settings?.currency || business.defaultCurrency, locale: settings?.locale || business.defaultLocale },
    settings: settings || { displayName: business.name, currency: business.defaultCurrency, locale: business.defaultLocale, contact: {}, socialLinks: [], seo: {} },
    media: { lazyLoading: settings?.mediaOptimization?.lazyLoading ?? true },
    theme: theme || null,
  })
})

export const storefrontPageController = asyncHandler(async (request, response) => {
  const business = tenant(request)
  const { slug } = (request.validated as { params: { slug: string } }).params
  const page = await ContentPage.findOne({ businessId: business._id, slug, status: 'published' }).select('pageKey slug title summary body faqs seo translations publishedAt updatedAt').lean()
  if (!page) throw new AppError(404, 'content_page_not_found', 'This page has not been published')
  response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  success(response, { page })
})

export const storefrontHomepageController = asyncHandler(async (request, response) => {
  success(response, { sections: await publicSections(tenant(request)._id, 'home') })
})

export const storefrontLandingPageController = asyncHandler(async (request, response) => {
  const business = tenant(request)
  const { slug } = (request.validated as { params: { slug: string } }).params
  const page = await LandingPage.findOne({ businessId: business._id, slug, status: 'published' }).select('slug title summary seo translations updatedAt').lean()
  if (!page) throw new AppError(404, 'landing_page_not_found', 'This landing page has not been published')
  success(response, { page, sections: await publicSections(business._id, slug) })
})
