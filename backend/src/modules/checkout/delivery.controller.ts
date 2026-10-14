import type { Request } from 'express'
import { DeliveryRule } from '../../models/DeliveryRule.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { ensureDeliveryDefaults, resolveDeliveryRule } from './delivery.service.js'
import { DeliveryLocation } from '../../models/DeliveryLocation.js'
import { ensureDeliveryLocationDefaults } from './delivery-locations.service.js'

function input<T>(request: Request): T { return request.validated as T }
function businessId(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business._id }
function key(value?: string) { return value?.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ') || '' }
function conflict(a: Record<string, any>, b: Record<string, any>) {
  const sameLocation = a.scope === b.scope && key(a.division) === key(b.division) && key(a.district) === key(b.district) && key(a.area) === key(b.area) && a.zone === b.zone && (a.courierCode || '') === (b.courierCode || '')
  const aMin = a.minimumSubtotal ?? 0, bMin = b.minimumSubtotal ?? 0, aMax = a.maximumSubtotal ?? Number.POSITIVE_INFINITY, bMax = b.maximumSubtotal ?? Number.POSITIVE_INFINITY
  return sameLocation && aMin <= bMax && bMin <= aMax
}
async function checkConflict(id: unknown, business: unknown, rule: Record<string, any>) {
  const others = await DeliveryRule.find({ businessId: business, ...(id ? { _id: { $ne: id } } : {}) }).lean() as unknown as Record<string, any>[]
  if (others.some((other) => conflict(other, rule))) throw new AppError(409, 'delivery_rule_conflict', 'A rule already covers this location, courier, and order range')
}

export const adminDeliveryRulesController = asyncHandler(async (request, response) => {
  const id = businessId(request)
  await ensureDeliveryDefaults(request.business!)
  const rules = await DeliveryRule.find({ businessId: id }).sort({ scope: 1, name: 1 }).lean()
  success(response, { rules })
})
export const createDeliveryRuleController = asyncHandler(async (request, response) => {
  const id = businessId(request), { body } = input<{ body: Record<string, any> }>(request)
  await ensureDeliveryDefaults(request.business!)
  await checkConflict(undefined, id, body)
  if (await DeliveryRule.exists({ businessId: id, code: body.code })) throw new AppError(409, 'delivery_rule_code_exists', 'That rule code is already in use')
  const rule = await DeliveryRule.create({ ...body, businessId: id })
  success(response, { rule }, 201)
})
export const updateDeliveryRuleController = asyncHandler(async (request, response) => {
  const id = businessId(request), { body } = input<{ body: Record<string, any>; params: { ruleId: string } }>(request)
  const ruleId = (request.validated as { params: { ruleId: string } }).params.ruleId
  await checkConflict(ruleId, id, body)
  if (await DeliveryRule.exists({ businessId: id, code: body.code, _id: { $ne: ruleId } })) throw new AppError(409, 'delivery_rule_code_exists', 'That rule code is already in use')
  const rule = await DeliveryRule.findOneAndUpdate({ _id: ruleId, businessId: id }, { $set: body }, { new: true, runValidators: true })
  if (!rule) throw new AppError(404, 'delivery_rule_not_found', 'Delivery rule was not found')
  success(response, { rule })
})
export const deleteDeliveryRuleController = asyncHandler(async (request, response) => {
  const id = businessId(request), ruleId = (request.validated as { params: { ruleId: string } }).params.ruleId
  if (!await DeliveryRule.findOneAndDelete({ _id: ruleId, businessId: id })) throw new AppError(404, 'delivery_rule_not_found', 'Delivery rule was not found')
  success(response, { deleted: true })
})
export const updateDeliveryRuleStatusController = asyncHandler(async (request, response) => {
  const id = businessId(request), ruleId = (request.validated as { params: { ruleId: string } }).params.ruleId
  const { enabled } = input<{ body: { enabled: boolean } }>(request).body
  const rule = await DeliveryRule.findOneAndUpdate({ _id: ruleId, businessId: id }, { $set: { enabled } }, { new: true, runValidators: true })
  if (!rule) throw new AppError(404, 'delivery_rule_not_found', 'Delivery rule was not found')
  success(response, { rule })
})
export const calculateDeliveryController = asyncHandler(async (request, response) => {
  const id = businessId(request), { body } = input<{ body: { address: Record<string, string>; subtotal: number; paymentMethod?: string; courierCode?: string } }>(request)
  await ensureDeliveryDefaults(request.business!)
  const quote = await resolveDeliveryRule(id, body.address, body.subtotal, body.paymentMethod, body.courierCode)
  success(response, { deliveryCharge: quote.fee, estimatedDelivery: quote.estimatedDelivery, label: quote.label, ruleCode: quote.rule.code })
})

export const deliveryLocationSuggestionsController = asyncHandler(async (request, response) => {
  const id = businessId(request), { q } = input<{ query: { q: string } }>(request).query
  await ensureDeliveryLocationDefaults(id)
  if (q.length < 2) { success(response, { locations: [] }); return }
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const locations = await DeliveryLocation.find({ businessId: id, enabled: true, deletedAt: { $exists: false }, $or: [
    { name: { $regex: escaped, $options: 'i' } }, { 'nameTranslations.en': { $regex: escaped, $options: 'i' } }, { 'nameTranslations.bn': { $regex: escaped, $options: 'i' } },
    { aliases: { $regex: escaped, $options: 'i' } }, { division: { $regex: escaped, $options: 'i' } }, { district: { $regex: escaped, $options: 'i' } }, { area: { $regex: escaped, $options: 'i' } },
  ] }).sort({ division: 1, district: 1, area: 1 }).limit(15).select('name nameTranslations division district area zone').lean()
  success(response, { locations })
})

export const adminDeliveryLocationsController = asyncHandler(async (request, response) => {
  const id = businessId(request)
  await ensureDeliveryLocationDefaults(id)
  const locations = await DeliveryLocation.find({ businessId: id, deletedAt: { $exists: false } }).sort({ division: 1, district: 1, area: 1 }).lean()
  success(response, { locations })
})
export const createDeliveryLocationController = asyncHandler(async (request, response) => {
  const id = businessId(request), { body } = input<{ body: Record<string, unknown> }>(request)
  await ensureDeliveryLocationDefaults(id)
  if (await DeliveryLocation.exists({ businessId: id, code: body.code })) throw new AppError(409, 'delivery_location_code_exists', 'That delivery location code is already in use')
  const location = await DeliveryLocation.create({ ...body, businessId: id })
  success(response, { location }, 201)
})
export const updateDeliveryLocationController = asyncHandler(async (request, response) => {
  const id = businessId(request), { body, params } = input<{ body: Record<string, unknown>; params: { locationId: string } }>(request)
  if (await DeliveryLocation.exists({ businessId: id, code: body.code, _id: { $ne: params.locationId } })) throw new AppError(409, 'delivery_location_code_exists', 'That delivery location code is already in use')
  const location = await DeliveryLocation.findOneAndUpdate({ _id: params.locationId, businessId: id, deletedAt: { $exists: false } }, { $set: body }, { new: true, runValidators: true })
  if (!location) throw new AppError(404, 'delivery_location_not_found', 'Delivery location was not found')
  success(response, { location })
})
export const deleteDeliveryLocationController = asyncHandler(async (request, response) => {
  const id = businessId(request), { locationId } = input<{ params: { locationId: string } }>(request).params
  if (!await DeliveryLocation.findOneAndUpdate({ _id: locationId, businessId: id, deletedAt: { $exists: false } }, { $set: { enabled: false, deletedAt: new Date() } })) throw new AppError(404, 'delivery_location_not_found', 'Delivery location was not found')
  success(response, { deleted: true })
})
export const updateDeliveryLocationStatusController = asyncHandler(async (request, response) => {
  const id = businessId(request), { locationId } = input<{ params: { locationId: string }; body: { enabled: boolean } }>(request).params
  const { enabled } = input<{ body: { enabled: boolean } }>(request).body
  const location = await DeliveryLocation.findOneAndUpdate({ _id: locationId, businessId: id, deletedAt: { $exists: false } }, { $set: { enabled } }, { new: true, runValidators: true })
  if (!location) throw new AppError(404, 'delivery_location_not_found', 'Delivery location was not found')
  success(response, { location })
})
