import mongoose from 'mongoose'
import type { Request } from 'express'
import { ContentPage } from '../../models/ContentPage.js'
import { Theme } from '../../models/Theme.js'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function input<T>(request: Request): T { return request.validated as T }
function businessId(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business._id }

export const adminThemesController = asyncHandler(async (request, response) => {
  const business = businessId(request)
  const themes = await Theme.find({ businessId: business }).sort({ updatedAt: -1 }).lean()
  success(response, { themes, publishedTheme: themes.find((theme) => theme.status === 'published') ?? null, draftTheme: themes.find((theme) => theme.status === 'draft') ?? null })
})

export const adminThemeCreateController = asyncHandler(async (request, response) => {
  const body = input<{ body: Record<string, any> }>(request).body
  const tenant = businessId(request)
  const latest = await Theme.findOne({ businessId: tenant }).sort({ version: -1 }).select('version').lean() as { version?: number } | null
  const theme = await Theme.create({ ...body, businessId: tenant, status: 'draft', version: (latest?.version ?? 0) + 1, createdBy: request.user?.id })
  success(response, { theme }, 201)
})

export const adminThemeUpdateController = asyncHandler(async (request, response) => {
  const { themeId } = input<{ params: { themeId: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { themeId: string }; body: Record<string, any> }>(request).body
  const theme = await Theme.findOneAndUpdate({ _id: themeId, businessId: businessId(request), status: 'draft' }, { $set: body }, { new: true, runValidators: true })
  if (!theme) throw new AppError(404, 'theme_draft_not_found', 'Editable theme draft was not found')
  success(response, { theme })
})

export const adminThemePublishController = asyncHandler(async (request, response) => {
  const { themeId } = input<{ params: { themeId: string } }>(request).params
  const tenant = businessId(request)
  const session = await mongoose.startSession()
  let published: unknown
  try {
    await session.withTransaction(async () => {
      const theme = await Theme.findOne({ _id: themeId, businessId: tenant, status: 'draft' }).session(session)
      if (!theme) throw new AppError(404, 'theme_draft_not_found', 'Editable theme draft was not found')
      await Theme.updateMany({ businessId: tenant, status: 'published' }, { $set: { status: 'archived' } }, { session })
      theme.status = 'published'
      theme.publishedAt = new Date()
      await theme.save({ session })
      await WebsiteSettings.findOneAndUpdate({ businessId: tenant }, { $set: { defaultThemeId: theme._id }, $setOnInsert: { businessId: tenant, displayName: request.business!.name, currency: request.business!.defaultCurrency } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, session })
      published = theme.toObject()
    })
  } finally { await session.endSession() }
  success(response, { theme: published })
})

export const adminThemesDeleteController = asyncHandler(async (request, response) => {
  const { themeId } = input<{ params: { themeId: string } }>(request).params
  const theme = await Theme.findOneAndDelete({ _id: themeId, businessId: businessId(request), status: 'draft' })
  if (!theme) throw new AppError(404, 'theme_draft_not_found', 'Editable theme draft was not found')
  success(response, { deleted: true })
})

export const adminContentPagesController = asyncHandler(async (request, response) => {
  const pages = await ContentPage.find({ businessId: businessId(request) }).sort({ pageKey: 1 }).lean()
  success(response, { pages })
})

export const adminContentPageSaveController = asyncHandler(async (request, response) => {
  const { pageKey } = input<{ params: { pageKey: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { pageKey: string }; body: Record<string, any> }>(request).body
  if (body.pageKey !== pageKey) throw new AppError(422, 'page_key_mismatch', 'The route and page key must match')
  const publishedAt = body.status === 'published' ? new Date() : undefined
  const page = await ContentPage.findOneAndUpdate({ businessId: businessId(request), pageKey }, { $set: { ...body, ...(publishedAt ? { publishedAt } : {}) }, $setOnInsert: { businessId: businessId(request) } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true })
  success(response, { page })
})

export const adminContentPageDeleteController = asyncHandler(async (request, response) => {
  const { pageKey } = input<{ params: { pageKey: string } }>(request).params
  const page = await ContentPage.findOneAndDelete({ businessId: businessId(request), pageKey })
  if (!page) throw new AppError(404, 'content_page_not_found', 'Content page was not found')
  success(response, { deleted: true })
})
