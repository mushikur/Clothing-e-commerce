import type { Request } from 'express'
import { WebsiteSettings } from '../../models/WebsiteSettings.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
function input<T>(request: Request): T { return request.validated as T }
export const adminWebsiteSettingsController = asyncHandler(async (request, response) => {
  const business = request.business
  if (!business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  const settings = await WebsiteSettings.findOne({ businessId: business._id }).lean()
  success(response, { settings: settings || { displayName: business.name, currency: business.defaultCurrency, locale: business.defaultLocale, contact: {}, socialLinks: [], seo: {} } })
})
export const adminWebsiteSettingsUpdateController = asyncHandler(async (request, response) => {
  const business = request.business
  if (!business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  const body = input<{ body: Record<string, unknown> }>(request).body
  const settings = await WebsiteSettings.findOneAndUpdate({ businessId: business._id }, { $set: body, $setOnInsert: { businessId: business._id } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true })
  success(response, { settings })
})
