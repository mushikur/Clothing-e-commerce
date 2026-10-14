import type { Request } from 'express'
import { CourierApiLog } from '../../models/CourierApiLog.js'
import { CourierConfiguration } from '../../models/CourierConfiguration.js'
import { Order } from '../../models/Order.js'
import { Shipment } from '../../models/Shipment.js'
import { env } from '../../config/env.js'
import { decryptSecret, encryptSecret } from '../../utils/secret-encryption.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { courierProvider } from './providers.js'
import { createOrderShipment } from './shipping.service.js'
import type { CourierProviderId } from './courier-provider.js'

function requireBusinessId(request: Request) { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return request.business._id }
function input<T>(request: Request): T { return request.validated as T }
function overview(provider: any) { const adapter = courierProvider(provider.provider); const credentialsConfigured = Boolean(provider.encryptedCredentials); return { provider: provider.provider, label: adapter.label, enabled: Boolean(provider.enabled), mode: provider.mode, credentialsConfigured, merchant: provider.merchant || {}, pickup: provider.pickup || {}, status: credentialsConfigured ? 'configured_unverified' : 'configuration_required', statusMessage: credentialsConfigured ? 'Credentials are stored, but the official API connection has not been verified.' : 'Verify the current official merchant API contract before enabling live requests.', capabilities: adapter.capabilities, lastTestedAt: provider.lastTestedAt || null, lastErrorCode: provider.lastErrorCode || null } }
const providerIds: CourierProviderId[] = ['steadfast', 'pathao', 'redx']
type CourierConfigSnapshot = { _id?: unknown; defaultProvider?: CourierProviderId; customerTrackingEnabled?: boolean; providers: Array<{ provider: CourierProviderId; enabled?: boolean; encryptedCredentials?: string; mode?: string; merchant?: Record<string, string>; pickup?: Record<string, string>; lastTestedAt?: Date; lastErrorCode?: string }> }

export const courierProvidersController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const config = await CourierConfiguration.findOne({ businessId }).select('+providers.encryptedCredentials').lean() as unknown as CourierConfigSnapshot | null
  const byId = new Map((config?.providers || []).map((provider) => [provider.provider, provider]))
  success(response, { defaultProvider: config?.defaultProvider || null, customerTrackingEnabled: config?.customerTrackingEnabled !== false, demoTrackingAvailable: env.NODE_ENV !== 'production', encryptionReady: Boolean(env.COURIER_CREDENTIALS_ENCRYPTION_KEY), providers: providerIds.map((providerId) => overview(byId.get(providerId) || { provider: providerId })) })
})

export const courierTrackingUpdateController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { enabled } = input<{ body: { enabled: boolean } }>(request).body
  const config = await CourierConfiguration.findOneAndUpdate({ businessId }, { $set: { customerTrackingEnabled: enabled }, $setOnInsert: { businessId } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true })
  success(response, { customerTrackingEnabled: config.customerTrackingEnabled !== false })
})

export const courierProviderUpdateController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { providerId } = input<{ params: { providerId: CourierProviderId }; body: { enabled: boolean; mode: 'sandbox' | 'live'; credentials?: Record<string, string>; clearCredentials?: boolean; merchant: Record<string, string>; pickup: Record<string, string> } }>(request).params
  const body = input<{ params: { providerId: CourierProviderId }; body: { enabled: boolean; mode: 'sandbox' | 'live'; credentials?: Record<string, string>; clearCredentials?: boolean; merchant: Record<string, string>; pickup: Record<string, string> } }>(request).body
  if (body.enabled && !body.credentials && !body.clearCredentials) {
    const existing = await CourierConfiguration.findOne({ businessId }).select('+providers.encryptedCredentials').lean() as unknown as CourierConfigSnapshot | null
    if (!existing?.providers.some((provider) => provider.provider === providerId && provider.encryptedCredentials)) throw new AppError(422, 'courier_credentials_required', 'Add provider credentials before enabling this courier')
  }
  const current = await CourierConfiguration.findOne({ businessId }).select('+providers.encryptedCredentials')
  const provider = current?.providers.find((item: any) => item.provider === providerId)
  let credentials = provider?.encryptedCredentials
  if (body.clearCredentials) credentials = undefined
  else if (body.credentials) {
    let existing: Record<string, string> = {}
    if (provider?.encryptedCredentials) existing = JSON.parse(decryptSecret(provider.encryptedCredentials)) as Record<string, string>
    credentials = encryptSecret(JSON.stringify({ ...existing, ...body.credentials }))
  }
  const update = {
    provider: providerId, enabled: body.enabled, mode: body.mode, encryptedCredentials: credentials,
    merchant: body.merchant, pickup: body.pickup, status: 'configuration_required', lastErrorCode: undefined,
  }
  const config = await CourierConfiguration.findOneAndUpdate({ businessId, 'providers.provider': providerId }, { $set: Object.fromEntries(Object.entries(update).map(([key, value]) => [`providers.$.${key}`, value])) }, { new: true, runValidators: true })
    .then(async (found) => found || CourierConfiguration.findOneAndUpdate({ businessId }, { $push: { providers: update } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }))
  const saved = await CourierConfiguration.findById(config._id).select('+providers.encryptedCredentials').lean() as unknown as CourierConfigSnapshot | null
  success(response, { provider: overview(saved?.providers.find((item) => item.provider === providerId) || { provider: providerId }) })
})

export const courierDefaultUpdateController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { providerId } = input<{ body: { providerId: CourierProviderId | null } }>(request).body
  if (providerId) {
    const config = await CourierConfiguration.findOne({ businessId }).lean() as unknown as CourierConfigSnapshot | null
    const selected = config?.providers.find((provider) => provider.provider === providerId)
    if (!selected?.enabled) throw new AppError(422, 'courier_not_enabled', 'Enable the selected courier before setting it as default')
  }
  const config = await CourierConfiguration.findOneAndUpdate({ businessId }, { $set: { defaultProvider: providerId || undefined }, $setOnInsert: { businessId } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true })
  success(response, { defaultProvider: config.defaultProvider || null })
})

export const courierConnectionTestController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { providerId } = input<{ params: { providerId: CourierProviderId } }>(request).params
  const adapter = courierProvider(providerId)
  await CourierApiLog.create({ businessId, provider: providerId, operation: 'connection_test', outcome: 'unavailable', errorCode: 'official_api_specification_required', message: 'Connection test not run: official API contract is not verified.' })
  success(response, { provider: providerId, status: 'configuration_required', tested: false, message: `${adapter.label} connection checks are disabled until its current official API specifications are available and verified. No test request was sent.` })
})

export const courierLogsController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { page, limit } = input<{ query: { page: number; limit: number } }>(request).query
  const [logs, total] = await Promise.all([CourierApiLog.find({ businessId }).select('provider operation orderId outcome statusCode errorCode message durationMs createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CourierApiLog.countDocuments({ businessId })])
  success(response, { logs }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const adminCreateShipmentController = asyncHandler(async (request, response) => {
  const { businessId } = (() => { if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found'); return { businessId: request.business._id } })()
  const { orderId } = input<{ params: { orderId: string }; body: { providerId: CourierProviderId } }>(request).params
  const { providerId } = input<{ params: { orderId: string }; body: { providerId: CourierProviderId } }>(request).body
  const config = await CourierConfiguration.findOne({ businessId }).select('+providers.encryptedCredentials').lean() as unknown as CourierConfigSnapshot | null
  const selected = config?.providers.find((provider) => provider.provider === providerId)
  if (!selected?.enabled || !selected.encryptedCredentials) throw new AppError(409, 'courier_configuration_required', 'Enable this courier and configure its credentials first')
  const shipment = await createOrderShipment(businessId, orderId, providerId)
  success(response, { shipment }, 201)
})

export const adminDemoShipmentController = asyncHandler(async (request, response) => {
  if (env.NODE_ENV === 'production') throw new AppError(404, 'route_not_found', 'This route was not found')
  const businessId = requireBusinessId(request)
  const { orderId } = input<{ params: { orderId: string } }>(request).params
  const order = await Order.findOne({ _id: orderId, businessId })
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  if (['cancelled', 'returned', 'refunded'].includes(order.status)) throw new AppError(409, 'order_not_shippable', 'This order cannot receive a shipment update')
  let shipment = await Shipment.findOne({ businessId, orderId })
  if (shipment && shipment.trackingMode !== 'simulated') throw new AppError(409, 'shipment_already_created', 'A non-demo shipment already exists for this order')
  const steps = ['booked', 'picked_up', 'in_transit', 'delivered'] as const
  const next = shipment ? (steps[Math.min(steps.indexOf(shipment.status as typeof steps[number]) + 1, steps.length - 1)] ?? 'booked') : 'booked'
  if (shipment?.status === 'delivered') throw new AppError(409, 'demo_tracking_complete', 'The simulated shipment has already reached its final status')
  const now = new Date()
  if (!shipment) shipment = new Shipment({ businessId, orderId, provider: 'demo', trackingMode: 'simulated', trackingNumber: `DEMO-${order.orderNumber}`, status: 'pending', currency: order.currency, shippingCost: order.shippingTotal })
  shipment.status = next
  shipment.bookedAt ??= now
  if (next === 'delivered') shipment.deliveredAt = now
  shipment.events.push({ code: `demo_${next}`, description: `DEMO / SIMULATED — ${next.replaceAll('_', ' ')}. No courier API was called.`, occurredAt: now, location: next === 'booked' ? 'Demo fulfillment desk' : 'Simulated route' })
  await shipment.save()
  order.shipmentId = shipment._id
  order.timeline.push({ status: order.status, note: `DEMO / SIMULATED shipment update: ${next.replaceAll('_', ' ')}.`, occurredAt: now })
  await order.save()
  success(response, { shipment: { provider: shipment.provider, trackingMode: shipment.trackingMode, trackingNumber: shipment.trackingNumber, status: shipment.status, trackingUrl: shipment.trackingUrl, events: shipment.events, bookedAt: shipment.bookedAt, deliveredAt: shipment.deliveredAt } }, shipment.isNew ? 201 : 200)
})

export const adminManualReturnShipmentController = asyncHandler(async (request, response) => {
  const businessId = requireBusinessId(request)
  const { orderId } = input<{ params: { orderId: string }; body: { provider: string; status: string; trackingNumber?: string; trackingUrl?: string; note?: string } }>(request).params
  const body = input<{ params: { orderId: string }; body: { provider: string; status: string; trackingNumber?: string; trackingUrl?: string; note?: string } }>(request).body
  const order = await Order.findOne({ _id: orderId, businessId })
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  if (!['approved', 'received'].includes(order.returnRequest?.status || '')) throw new AppError(409, 'return_not_approved', 'Approve the return request before recording return delivery')
  let shipment = await Shipment.findOne({ businessId, orderId })
  if (!shipment) shipment = new Shipment({ businessId, orderId, provider: 'manual_return', status: 'pending' })
  shipment.returnShipment = { provider: body.provider, status: body.status, trackingNumber: body.trackingNumber, trackingUrl: body.trackingUrl, limitation: 'Manually recorded. Official return-shipment API support is not verified.', events: [...(shipment.returnShipment?.events || []), { code: body.status, description: body.note || `Return shipment ${body.status.replaceAll('_', ' ')}`, occurredAt: new Date() }] } as never
  await shipment.save()
  order.shipmentId = shipment._id
  if (body.status === 'returned' && order.returnRequest) { order.returnRequest.status = 'received'; order.returnRequest.resolvedAt = new Date(); order.returnRequest.resolutionNote = body.note || 'Return shipment received; inspection pending.' }
  order.timeline.push({ status: order.status, note: `Manual return shipment ${body.status.replaceAll('_', ' ')} recorded`, occurredAt: new Date() })
  await order.save()
  success(response, { returnShipment: shipment.returnShipment })
})
