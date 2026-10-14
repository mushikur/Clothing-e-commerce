import { createHash, timingSafeEqual } from 'node:crypto'
import mongoose, { type Types } from 'mongoose'
import type { Request } from 'express'
import { Business } from '../../models/Business.js'
import { Coupon } from '../../models/Coupon.js'
import { Inventory } from '../../models/Inventory.js'
import { InventoryTransaction } from '../../models/InventoryTransaction.js'
import { Order } from '../../models/Order.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Payment } from '../../models/Payment.js'
import { Shipment } from '../../models/Shipment.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { paymentProvider } from '../payments/payment-providers.js'

function input<T>(request: Request): T { return request.validated as T }
function scope(request: Request) {
  if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  return { businessId: request.business._id, userId: request.user?.id }
}
const transitions: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'], processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'], shipped: ['out_for_delivery', 'delivered'], out_for_delivery: ['delivered'],
  delivered: ['returned'], returned: ['refunded'], cancelled: ['refunded'], refunded: [],
}

export const adminOrdersController = asyncHandler(async (request, response) => {
  const { businessId } = scope(request)
  const {page,limit,status,q,payment,courier,from,to}=input<{query:{page:number;limit:number;status?:string;q?:string;payment?:string;courier?:string;from?:Date;to?:Date}}>(request).query
  const literal=q?new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'):undefined
  const filter={businessId,deletedAt:{$exists:false},...(status?{status}:{}),...(literal?{$or:[{orderNumber:literal},{'customer.name':literal},{'customer.email':literal},{'customer.phone':literal}]}:{}),...(from||to?{createdAt:{...(from?{$gte:from}:{}),...(to?{$lte:to}:{})}}:{})}
  const joins:mongoose.PipelineStage.FacetPipelineStage[]=[
    {$lookup:{from:Payment.collection.name,localField:'paymentId',foreignField:'_id',pipeline:[{$match:{businessId}},{$project:{provider:1,status:1}}],as:'paymentRecord'}},
    {$lookup:{from:Shipment.collection.name,localField:'shipmentId',foreignField:'_id',pipeline:[{$match:{businessId}},{$project:{provider:1,status:1,trackingNumber:1}}],as:'shipmentRecord'}},
    ...(payment?[{$match:{'paymentRecord.provider':payment}}]:[]),...(courier?[{$match:{'shipmentRecord.provider':courier}}]:[]),
  ]
  const [result]=await Order.aggregate([
    {$match:filter},...(payment||courier?joins:[]),{$facet:{
      orders:[{$sort:{createdAt:-1,_id:-1}},{$skip:(page-1)*limit},{$limit:limit},...(!payment&&!courier?joins:[]),{$project:{orderNumber:1,customer:1,status:1,currency:1,grandTotal:1,placedAt:1,returnRequest:1,createdAt:1,paymentId:{$arrayElemAt:['$paymentRecord',0]},shipmentId:{$arrayElemAt:['$shipmentRecord',0]}}}],
      count:[{$count:'total'}],
    }},
  ])
  const orders=result?.orders??[],total=result?.count?.[0]?.total??0
  success(response, { orders }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const adminOrderDetailController = asyncHandler(async (request, response) => {
  const { businessId } = scope(request)
  const { orderId } = input<{ params: { orderId: string } }>(request).params
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId }).select('-__v').lean() as unknown as Record<string, any> | null
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  const [items, payment, shipment] = await Promise.all([
    OrderItem.find({ businessId, orderId }).select('productNameSnapshot productNameTranslations skuSnapshot attributesSnapshot unitPrice quantity discountAmount taxAmount lineTotal').lean(),
    Payment.findOne({ businessId, orderId }).select('provider amount currency status providerReference customerReference submittedAt verifiedAt refundedAt refundReference failureCode failureMessage publicInstructions collectionDetails createdAt updatedAt').lean(),
    Shipment.findOne({ businessId, orderId }).select('provider trackingMode shipmentId consignmentId status trackingNumber trackingUrl events bookedAt deliveredAt returnShipment shippingCost currency createdAt updatedAt').lean(),
  ])
  success(response, { order, items, payment, shipment })
})

export const adminOrderStatusController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: { status: string; note?: string; reason?: string } }>(request).params
  const { status, note, reason } = input<{ params: { orderId: string }; body: { status: string; note?: string; reason?: string } }>(request).body
  const session = await mongoose.startSession()
  let updated: unknown
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId }).session(session)
      if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
      if (!transitions[order.status]?.includes(status)) throw new AppError(409, 'invalid_order_transition', `An order cannot move from ${order.status} to ${status}`)
      if (status === 'returned' && order.returnRequest?.status !== 'approved') throw new AppError(409, 'return_not_approved', 'Approve a customer return before receiving the items')
      if (status === 'confirmed' && order.paymentId) {
        const payment = await Payment.findOne({ _id: order.paymentId, businessId }).session(session)
        if (payment?.provider !== 'cash_on_delivery' && payment?.status !== 'captured') throw new AppError(409, 'payment_not_verified', 'Verify the payment before confirming this order')
      }
      const orderLines = ['shipped', 'cancelled', 'returned'].includes(status) ? await OrderItem.find({ businessId, orderId }).session(session).lean() : []
      if (status === 'shipped' || status === 'cancelled' || status === 'returned') {
        for (const line of orderLines as unknown as Array<{ variantId: Types.ObjectId; quantity: number }>) {
          if (status === 'shipped') {
            const stock = await Inventory.findOneAndUpdate({ businessId, variantId: line.variantId, locationCode: 'DEFAULT', reserved: { $gte: line.quantity }, onHand: { $gte: line.quantity } }, { $inc: { reserved: -line.quantity, onHand: -line.quantity } }, { new: true, session })
            if (!stock) throw new AppError(409, 'inventory_reservation_missing', 'Reserved inventory could not be fulfilled; review inventory before shipping')
            await InventoryTransaction.create([{ businessId, inventoryId: stock._id, variantId: line.variantId, type: 'sale', quantityDelta: -line.quantity, reason: `Fulfilled order ${order.orderNumber}`, sourceType: 'order', sourceId: order._id, idempotencyKey: `${order.idempotencyKey || order.id}:sale:${line.variantId}`, actorUserId: userId }], { session })
          } else if (status === 'cancelled') {
            const stock = await Inventory.findOneAndUpdate({ businessId, variantId: line.variantId, locationCode: 'DEFAULT', reserved: { $gte: line.quantity } }, { $inc: { reserved: -line.quantity } }, { new: true, session })
            if (!stock) throw new AppError(409, 'inventory_reservation_missing', 'Inventory reservation could not be released; review inventory before cancelling')
            await InventoryTransaction.create([{ businessId, inventoryId: stock._id, variantId: line.variantId, type: 'release', quantityDelta: -line.quantity, reason: `Released for cancelled order ${order.orderNumber}`, sourceType: 'order', sourceId: order._id, idempotencyKey: `${order.idempotencyKey || order.id}:release:${line.variantId}`, actorUserId: userId }], { session })
          } else {
            const stock = await Inventory.findOneAndUpdate({ businessId, variantId: line.variantId, locationCode: 'DEFAULT' }, { $inc: { onHand: line.quantity } }, { new: true, session })
            if (!stock) throw new AppError(409, 'inventory_record_missing', 'Inventory record was not found for the returned items')
            await InventoryTransaction.create([{ businessId, inventoryId: stock._id, variantId: line.variantId, type: 'return', quantityDelta: line.quantity, reason: `Restocked returned order ${order.orderNumber}`, sourceType: 'return', sourceId: order._id, idempotencyKey: `${order.idempotencyKey || order.id}:return:${line.variantId}`, actorUserId: userId }], { session })
          }
        }
      }
      order.status = status as never
      if (status === 'cancelled') { order.cancelledAt = new Date(); order.cancellationReason = reason || note }
      if (status === 'returned' && order.returnRequest) { order.returnRequest.status = 'received'; order.returnRequest.resolvedAt = new Date() }
      if (status === 'delivered' && order.paymentId) {
        const payment = await Payment.findOne({ _id: order.paymentId, businessId }).session(session)
        if (payment?.provider === 'cash_on_delivery' && payment.status === 'created') { payment.status = 'captured'; payment.verifiedAt = new Date(); await payment.save({ session }) }
      }
      if (status === 'cancelled' && order.paymentId) {
        const payment = await Payment.findOne({ _id: order.paymentId, businessId }).session(session)
        if (payment && !['captured', 'refunded'].includes(payment.status)) { payment.status = 'cancelled'; await payment.save({ session }) }
      }
      if (status === 'cancelled' && order.couponId) await Coupon.updateOne({ _id: order.couponId, businessId, redemptionCount: { $gt: 0 } }, { $inc: { redemptionCount: -1 } }, { session })
      order.timeline.push({ status, note: reason || note || `Order ${status.replaceAll('_', ' ')}`, actorUserId: userId as never, occurredAt: new Date() })
      await order.save({ session })
      updated = { orderNumber: order.orderNumber, status: order.status, timeline: order.timeline }
    })
  } finally { await session.endSession() }
  success(response, updated)
})

export const adminOrderPaymentController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: { action: 'verify' | 'fail' | 'refund'; reference?: string; note?: string } }>(request).params
  const { action, reference, note } = input<{ params: { orderId: string }; body: { action: 'verify' | 'fail' | 'refund'; reference?: string; note?: string } }>(request).body
  const session = await mongoose.startSession()
  let result: unknown
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId }).session(session)
      if (!order?.paymentId) throw new AppError(404, 'payment_not_found', 'Payment was not found for this order')
      const payment = await Payment.findOne({ _id: order.paymentId, businessId }).session(session)
      if (!payment) throw new AppError(404, 'payment_not_found', 'Payment was not found for this order')
      const provider = paymentProvider(payment.provider)
      if (action === 'verify') {
        if (payment.provider === 'cash_on_delivery' && payment.status !== 'created') throw new AppError(409, 'payment_not_verifiable', 'This cash payment is not awaiting collection')
        if (payment.provider !== 'cash_on_delivery' && payment.status !== 'authorized') throw new AppError(409, 'payment_not_verifiable', 'A customer transaction ID must be submitted before verification')
        if (payment.provider === 'cash_on_delivery' && order.status !== 'delivered') throw new AppError(409, 'cash_not_collected', 'Cash on delivery can be marked collected after the order is delivered')
        if (payment.provider !== 'cash_on_delivery' && !payment.customerReference) throw new AppError(409, 'transaction_reference_missing', 'The customer has not submitted a transaction ID')
        const verification = await provider.verify({ customerReference: payment.customerReference })
        if (!verification.verified) throw new AppError(409, 'payment_verification_failed', 'The provider could not verify this payment')
        payment.status = 'captured'; payment.verifiedAt = new Date(); payment.providerReference = reference || payment.customerReference
        if (order.status === 'pending' && payment.provider !== 'cash_on_delivery') {
          order.status = 'confirmed'
          order.timeline.push({ status: 'confirmed', note: `Payment verified${note ? `: ${note}` : ''}`, actorUserId: userId as never, occurredAt: new Date() })
          await order.save({ session })
        }
      } else if (action === 'fail') {
        if (!['created', 'requires_action', 'authorized'].includes(payment.status)) throw new AppError(409, 'payment_already_settled', 'This payment cannot be marked failed in its current state')
        payment.status = 'failed'; payment.failureMessage = note || 'Payment could not be verified'
        order.timeline.push({ status: order.status, note: `${payment.provider} payment marked failed${note ? `: ${note}` : ''}`, actorUserId: userId as never, occurredAt: new Date() })
        await order.save({ session })
      } else {
        if (payment.status !== 'captured') throw new AppError(409, 'payment_not_captured', 'Only a captured payment can be refunded')
        if (!['returned', 'cancelled'].includes(order.status)) throw new AppError(409, 'order_not_refundable', 'Return or cancel the order before recording a refund')
        if (!reference) throw new AppError(422, 'refund_reference_required', 'Enter the refund transaction reference after processing it with the provider')
        const refund = await provider.refund({ amount: payment.amount, reference })
        if (!refund.processed) throw new AppError(409, 'refund_reference_invalid', 'Enter a valid refund reference')
        payment.status = 'refunded'; payment.refundedAt = new Date(); payment.refundReference = refund.reference
        order.status = 'refunded'; order.refundedAt = new Date(); order.refundReference = refund.reference
        order.timeline.push({ status: 'refunded', note: note || 'Refund recorded by store', actorUserId: userId as never, occurredAt: new Date() })
        await order.save({ session })
      }
      await payment.save({ session })
      result = { status: payment.status, provider: payment.provider, verifiedAt: payment.verifiedAt, refundedAt: payment.refundedAt, refundReference: payment.refundReference }
    })
  } finally { await session.endSession() }
  success(response, result)
})

export const customerPaymentReferenceController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: { transactionId: string } }>(request).params
  const { transactionId } = input<{ params: { orderId: string }; body: { transactionId: string } }>(request).body
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId, userId })
  if (!order?.paymentId) throw new AppError(404, 'order_not_found', 'Order was not found')
  const payment = await Payment.findOne({ _id: order.paymentId, businessId })
  if (['cancelled', 'returned', 'refunded'].includes(order.status) || !payment || !['bkash', 'nagad'].includes(payment.provider) || !['requires_action', 'failed'].includes(payment.status)) throw new AppError(409, 'payment_not_awaiting_reference', 'This order is not awaiting a mobile wallet transaction ID')
  payment.customerReference = transactionId; payment.submittedAt = new Date(); payment.status = 'authorized'; payment.failureCode = undefined; payment.failureMessage = undefined
  await payment.save()
  order.timeline.push({ status: order.status, note: `${payment.provider === 'bkash' ? 'bKash' : 'Nagad'} transaction ID submitted for verification`, occurredAt: new Date() })
  await order.save()
  success(response, { paymentStatus: payment.status, message: 'Transaction ID submitted for store verification' })
})

export const guestPaymentReferenceController = asyncHandler(async (request, response) => {
  const businessId = request.business?._id
  if (!businessId) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  const { orderId } = input<{ params: { orderId: string }; body: { transactionId: string; guestAccessToken: string } }>(request).params
  const { transactionId, guestAccessToken } = input<{ params: { orderId: string }; body: { transactionId: string; guestAccessToken: string } }>(request).body
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId }).select('+guestAccessTokenHash guestAccessExpiresAt paymentId orderNumber timeline')
  const submittedHash = createHash('sha256').update(guestAccessToken).digest()
  const storedHash = order?.guestAccessTokenHash ? Buffer.from(order.guestAccessTokenHash, 'hex') : Buffer.alloc(0)
  if (!order || !order.guestAccessExpiresAt || order.guestAccessExpiresAt <= new Date() || storedHash.length !== submittedHash.length || !timingSafeEqual(storedHash, submittedHash)) throw new AppError(404, 'order_not_found', 'Order was not found')
  const payment = await Payment.findOne({ _id: order.paymentId, businessId })
  if (['cancelled', 'returned', 'refunded'].includes(order.status) || !payment || !['bkash', 'nagad'].includes(payment.provider) || !['requires_action', 'failed'].includes(payment.status)) throw new AppError(409, 'payment_not_awaiting_reference', 'This order is not awaiting a mobile wallet transaction ID')
  payment.customerReference = transactionId; payment.submittedAt = new Date(); payment.status = 'authorized'; payment.failureCode = undefined; payment.failureMessage = undefined
  await payment.save()
  order.timeline.push({ status: order.status, note: `${payment.provider === 'bkash' ? 'bKash' : 'Nagad'} transaction ID submitted for verification`, occurredAt: new Date() })
  await order.save()
  success(response, { paymentStatus: payment.status, message: 'Transaction ID submitted for store verification' })
})

export const customerReturnRequestController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: { reason: string } }>(request).params
  const { reason } = input<{ params: { orderId: string }; body: { reason: string } }>(request).body
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId, userId })
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  if (order.status !== 'delivered') throw new AppError(409, 'order_not_returnable', 'Only delivered orders can have a return requested')
  if (order.returnRequest?.status) throw new AppError(409, 'return_already_requested', 'A return request already exists for this order')
  order.returnRequest = { status: 'requested', reason, requestedAt: new Date() }
  order.timeline.push({ status: order.status, note: 'Customer requested a return', occurredAt: new Date() })
  await order.save()
  success(response, { returnRequest: order.returnRequest }, 201)
})

export const adminOrderReturnController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: { action: 'approve' | 'reject' | 'received'; note?: string } }>(request).params
  const { action, note } = input<{ params: { orderId: string }; body: { action: 'approve' | 'reject' | 'received'; note?: string } }>(request).body
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId })
  if (!order || order.returnRequest?.status !== 'requested') throw new AppError(409, 'return_action_unavailable', 'There is no return request awaiting review')
  const next = action === 'approve' ? 'approved' : 'rejected'
  order.returnRequest.status = next; order.returnRequest.resolvedAt = new Date(); order.returnRequest.resolutionNote = note
  order.timeline.push({ status: order.status, note: `Return ${next}${note ? `: ${note}` : ''}`, actorUserId: userId as never, occurredAt: new Date() })
  await order.save()
  success(response, { returnRequest: order.returnRequest })
})

export const adminShipmentController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { orderId: string }; body: Record<string, any> }>(request).body
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId })
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  const shipment = await Shipment.findOneAndUpdate({ businessId, orderId }, { $set: { ...body, trackingMode: 'manual' }, $setOnInsert: { businessId, orderId } }, { new: true, upsert: true, runValidators: true })
  order.shipmentId = shipment._id
  if (body.status === 'delivered' && order.status === 'out_for_delivery') {
    order.status = 'delivered'; order.timeline.push({ status: 'delivered', note: 'Carrier marked shipment delivered', actorUserId: userId as never, occurredAt: new Date() })
  }
  await order.save()
  success(response, { shipment })
})

export const updatePaymentSettingsController = asyncHandler(async (request, response) => {
  const { businessId } = scope(request)
  const { paymentMethods } = input<{ body: { paymentMethods: Array<{ code: 'bkash' | 'nagad'; enabled: boolean; merchantNumber?: string; accountType?: string; instructions?: string }> } }>(request).body
  if (paymentMethods.some((method) => method.enabled && !method.merchantNumber?.trim())) throw new AppError(422, 'merchant_number_required', 'Enter a merchant number before enabling a mobile wallet')
  const business = await Business.findById(businessId)
  if (!business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  business.checkout ??= {} as never
  business.checkout.paymentMethods = paymentMethods as never
  await business.save()
  success(response, { paymentMethods: paymentMethods.map(({ code, enabled, merchantNumber, accountType, instructions }) => ({ code, enabled, merchantNumber, accountType, instructions })) })
})

export const paymentSettingsController = asyncHandler(async (request, response) => {
  const business = request.business
  if (!business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  const methods = (business.checkout?.paymentMethods ?? []) as unknown as Array<{ code: string; enabled: boolean; merchantNumber?: string; accountType?: string; instructions?: string }>
  success(response, { paymentMethods: methods.map(({ code, enabled, merchantNumber, accountType, instructions }) => ({ code, enabled, merchantNumber, accountType, instructions })) })
})
