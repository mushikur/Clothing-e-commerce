import mongoose from 'mongoose'
import { CourierApiLog } from '../../models/CourierApiLog.js'
import { CourierConfiguration } from '../../models/CourierConfiguration.js'
import { Order } from '../../models/Order.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Payment } from '../../models/Payment.js'
import { Shipment } from '../../models/Shipment.js'
import { AppError } from '../../utils/app-error.js'
import { courierProvider } from './providers.js'
import type { CourierProviderId } from './courier-provider.js'

export async function createOrderShipment(businessId: mongoose.Types.ObjectId, orderId: string, providerId?: CourierProviderId) {
  const startedAt = Date.now()
  const [order, config] = await Promise.all([Order.findOne({ _id: orderId, businessId }), CourierConfiguration.findOne({ businessId }).lean() as unknown as { defaultProvider?: CourierProviderId } | null])
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  if (!['confirmed', 'processing', 'packed'].includes(order.status)) throw new AppError(409, 'order_not_shippable', 'Confirm and prepare the order before creating its shipment')
  if (order.shipmentId || await Shipment.exists({ businessId, orderId })) throw new AppError(409, 'shipment_already_created', 'A shipment or booking attempt is already associated with this order; reconcile its courier status before retrying')
  const provider = providerId || config?.defaultProvider
  if (!provider) throw new AppError(409, 'default_courier_required', 'Choose a default courier or select one for this order')
  const adapter = courierProvider(provider)
  const idempotencyKey = `${businessId}:${order.orderNumber}`
  let booking
  try {
    booking = await Shipment.create({ businessId, orderId, provider, status: 'pending', idempotencyKey })
    const [payment, lines] = await Promise.all([order.paymentId ? Payment.findOne({ _id: order.paymentId, businessId }).select('provider').lean() as unknown as { provider: string } | null : null, OrderItem.find({ businessId, orderId }).select('productNameSnapshot').limit(20).lean()])
    const shipment = await adapter.createShipment({ orderNumber: order.orderNumber, recipientName: order.shippingAddress.recipientName, recipientPhone: order.shippingAddress.phone, recipientAddress: [order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.area, order.shippingAddress.district, order.shippingAddress.division, order.shippingAddress.postalCode].filter(Boolean).join(', '), city: order.shippingAddress.district || order.shippingAddress.city, region: order.shippingAddress.division || order.shippingAddress.region, postalCode: order.shippingAddress.postalCode, codAmount: payment?.provider === 'cash_on_delivery' ? order.grandTotal : 0, currency: order.currency, note: order.shippingAddress.deliveryInstructions, parcelDescription: lines.map((line) => line.productNameSnapshot).join(', ').slice(0, 240) || 'Clothing order' }, idempotencyKey)
    booking.shipmentId = shipment.shipmentId
    booking.consignmentId = shipment.consignmentId
    booking.trackingNumber = shipment.trackingId
    booking.trackingUrl = shipment.trackingUrl
    booking.status = 'booked'
    booking.providerReference = shipment.providerReference
    booking.bookedAt = new Date()
    await booking.save()
    const saved = booking
    order.shipmentId = saved._id
    await order.save()
    await CourierApiLog.create({ businessId, provider, operation: 'create_shipment', orderId, outcome: 'success', durationMs: Date.now() - startedAt })
    return saved
  } catch (error) {
    const unavailable = error instanceof Error && error.name === 'CourierDocumentationRequiredError'
    if (unavailable && booking) await Shipment.deleteOne({ _id: booking._id, businessId, status: 'pending' })
    else if (booking) { booking.status = 'failed'; booking.lastErrorCode = 'provider_error'; await booking.save().catch(() => undefined) }
    await CourierApiLog.create({ businessId, provider, operation: 'create_shipment', orderId, outcome: unavailable ? 'unavailable' : 'error', errorCode: unavailable ? 'official_api_specification_required' : 'provider_error', message: unavailable ? 'Official API integration is not verified' : 'Courier shipment request failed; reconcile before retrying', durationMs: Date.now() - startedAt })
    if (unavailable) throw new AppError(503, 'courier_configuration_required', `${adapter.label} is Configuration Required. Verify its official merchant API documentation before enabling shipment creation.`)
    throw error
  }
}
