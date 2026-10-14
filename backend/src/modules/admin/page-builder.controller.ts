import type { Request } from 'express'
import { Category } from '../../models/Category.js'
import { HomepageSection } from '../../models/HomepageSection.js'
import { LandingPage } from '../../models/LandingPage.js'
import { Product } from '../../models/Product.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function input<T>(request: Request): T { return request.validated as T }
function tenant(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business._id }
function plainContent(value: unknown) { return value instanceof Map ? Object.fromEntries(value) : (value || {}) }

async function validateSectionReferences(businessId: unknown, body: Record<string, any>) {
  if (body.pageKey !== 'home' && !await LandingPage.exists({ businessId, slug: body.pageKey })) throw new AppError(422, 'landing_page_not_found', 'Create the landing page before adding its sections')
  const content = body.content || {}
  const productIds = content.productIds || []
  const categoryIds = [...(content.categoryIds || []), ...(content.categoryId ? [content.categoryId] : [])]
  const [productCount, categoryCount] = await Promise.all([
    productIds.length ? Product.countDocuments({ businessId, _id: { $in: productIds }, status: 'published' }) : 0,
    categoryIds.length ? Category.countDocuments({ businessId, _id: { $in: categoryIds }, status: 'active' }) : 0,
  ])
  if (productCount !== productIds.length || categoryCount !== categoryIds.length) throw new AppError(422, 'section_scope_invalid', 'Selected products and categories must be published and belong to this storefront')
}

export const adminSectionsController = asyncHandler(async (request, response) => {
  const { pageKey } = input<{ query: { pageKey: string } }>(request).query
  const sections = await HomepageSection.find({ businessId: tenant(request), pageKey }).sort({ sortOrder: 1, createdAt: 1 }).lean()
  success(response, { sections: sections.map((section) => ({ ...section, content: plainContent(section.content) })) })
})

export const adminSectionCreateController = asyncHandler(async (request, response) => {
  const body = input<{ body: Record<string, any> }>(request).body
  const businessId = tenant(request)
  await validateSectionReferences(businessId, body)
  const sortOrder = body.sortOrder ?? await HomepageSection.countDocuments({ businessId, pageKey: body.pageKey })
  const section = await HomepageSection.create({ ...body, sortOrder, businessId })
  success(response, { section }, 201)
})

export const adminSectionUpdateController = asyncHandler(async (request, response) => {
  const { sectionId } = input<{ params: { sectionId: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { sectionId: string }; body: Record<string, any> }>(request).body
  const businessId = tenant(request)
  await validateSectionReferences(businessId, body)
  const section = await HomepageSection.findOneAndUpdate({ _id: sectionId, businessId }, { $set: body }, { new: true, runValidators: true })
  if (!section) throw new AppError(404, 'homepage_section_not_found', 'Section was not found')
  success(response, { section: { ...section.toObject(), content: plainContent(section.content) } })
})

export const adminSectionDeleteController = asyncHandler(async (request, response) => {
  const { sectionId } = input<{ params: { sectionId: string } }>(request).params
  const section = await HomepageSection.findOneAndDelete({ _id: sectionId, businessId: tenant(request) })
  if (!section) throw new AppError(404, 'homepage_section_not_found', 'Section was not found')
  success(response, { deleted: true })
})

export const adminSectionsReorderController = asyncHandler(async (request, response) => {
  const { pageKey, sectionIds } = input<{ body: { pageKey: string; sectionIds: string[] } }>(request).body
  const businessId = tenant(request)
  const matching = await HomepageSection.countDocuments({ businessId, pageKey, _id: { $in: sectionIds } })
  if (matching !== sectionIds.length) throw new AppError(422, 'section_order_invalid', 'All sections must belong to this page')
  await HomepageSection.bulkWrite(sectionIds.map((sectionId, sortOrder) => ({ updateOne: { filter: { _id: sectionId, businessId, pageKey }, update: { $set: { sortOrder } } } })))
  const sections = await HomepageSection.find({ businessId, pageKey }).sort({ sortOrder: 1, createdAt: 1 }).lean()
  success(response, { sections: sections.map((section) => ({ ...section, content: plainContent(section.content) })) })
})

export const adminLandingPagesController = asyncHandler(async (request, response) => {
  const pages = await LandingPage.find({ businessId: tenant(request) }).sort({ updatedAt: -1 }).lean()
  success(response, { pages })
})

export const adminLandingPageCreateController = asyncHandler(async (request, response) => {
  const body = input<{ body: Record<string, any> }>(request).body
  const page = await LandingPage.create({ ...body, businessId: tenant(request), ...(body.status === 'published' ? { publishedAt: new Date() } : {}) })
  success(response, { page }, 201)
})

export const adminLandingPageUpdateController = asyncHandler(async (request, response) => {
  const { landingPageId } = input<{ params: { landingPageId: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { landingPageId: string }; body: Record<string, any> }>(request).body
  const businessId = tenant(request)
  const current = await LandingPage.findOne({ _id: landingPageId, businessId })
  if (!current) throw new AppError(404, 'landing_page_not_found', 'Landing page was not found')
  if (body.slug !== current.slug) await HomepageSection.updateMany({ businessId, pageKey: current.slug }, { $set: { pageKey: body.slug } })
  const page = await LandingPage.findOneAndUpdate({ _id: landingPageId, businessId }, { $set: { ...body, ...(body.status === 'published' ? { publishedAt: new Date() } : {}) } }, { new: true, runValidators: true })
  success(response, { page })
})

export const adminLandingPageDeleteController = asyncHandler(async (request, response) => {
  const { landingPageId } = input<{ params: { landingPageId: string } }>(request).params
  const businessId = tenant(request)
  const page = await LandingPage.findOneAndDelete({ _id: landingPageId, businessId })
  if (!page) throw new AppError(404, 'landing_page_not_found', 'Landing page was not found')
  await HomepageSection.deleteMany({ businessId, pageKey: page.slug })
  success(response, { deleted: true })
})
