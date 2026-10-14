import type { Request } from 'express'
import { Address } from '../../models/Address.js'
import mongoose from 'mongoose'
import { Cart } from '../../models/Cart.js'
import { CourierConfiguration } from '../../models/CourierConfiguration.js'
import { Inventory } from '../../models/Inventory.js'
import { Notification } from '../../models/Notification.js'
import { Order } from '../../models/Order.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Payment } from '../../models/Payment.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { Shipment } from '../../models/Shipment.js'
import { User } from '../../models/User.js'
import { Wishlist } from '../../models/Wishlist.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function input<T>(request: Request): T { return request.validated as T }
function scope(request: Request) {
  if (!request.user || !request.business) throw new AppError(401, 'authentication_required', 'Sign in is required')
  return { businessId: request.business._id, userId: request.user.id }
}

export const profileController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const body = input<{ body: { name: string; phone?: string } }>(request).body
  const user = await User.findOneAndUpdate({ _id: userId, businessId, status: 'active' }, { $set: body }, { new: true, runValidators: true }).select('name email phone role emailVerifiedAt createdAt')
  if (!user) throw new AppError(404, 'user_not_found', 'Account was not found')
  success(response, { user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, emailVerifiedAt: user.emailVerifiedAt, createdAt: user.createdAt } })
})

export const addressListController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const addresses = await Address.find({ businessId, userId }).sort({ isDefaultShipping: -1, createdAt: -1 }).lean()
  success(response, { addresses })
})

export const addressCreateController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const body = input<{ body: Record<string, unknown> }>(request).body
  if (body.isDefaultShipping) await Address.updateMany({ businessId, userId, isDefaultShipping: true }, { $set: { isDefaultShipping: false } })
  if (body.isDefaultBilling) await Address.updateMany({ businessId, userId, isDefaultBilling: true }, { $set: { isDefaultBilling: false } })
  const address = await Address.create({ ...body, businessId, userId })
  success(response, { address }, 201)
})

export const addressUpdateController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { addressId } = input<{ params: { addressId: string } }>(request).params
  const body = input<{ body: Record<string, unknown> }>(request).body
  if (body.isDefaultShipping) await Address.updateMany({ businessId, userId, _id: { $ne: addressId }, isDefaultShipping: true }, { $set: { isDefaultShipping: false } })
  if (body.isDefaultBilling) await Address.updateMany({ businessId, userId, _id: { $ne: addressId }, isDefaultBilling: true }, { $set: { isDefaultBilling: false } })
  const address = await Address.findOneAndUpdate({ _id: addressId, businessId, userId }, { $set: body }, { new: true, runValidators: true })
  if (!address) throw new AppError(404, 'address_not_found', 'Address was not found')
  success(response, { address })
})

export const addressDeleteController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { addressId } = input<{ params: { addressId: string } }>(request).params
  const address = await Address.findOneAndDelete({ _id: addressId, businessId, userId })
  if (!address) throw new AppError(404, 'address_not_found', 'Address was not found')
  success(response, { deleted: true })
})

export const ordersController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { page, limit } = input<{ query: { page: number; limit: number } }>(request).query
  const filter = { businessId, userId, deletedAt: { $exists: false } }
  const [orders, total] = await Promise.all([
    Order.find(filter).select('orderNumber status currency grandTotal placedAt createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ])
  success(response, { orders }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const orderDetailController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string } }>(request).params
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId, userId }).select('-__v').lean() as unknown as Record<string, any> | null
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  const [items, storedShipment, payment, courierConfig] = await Promise.all([
    OrderItem.find({ businessId, orderId }).select('productNameSnapshot productNameTranslations skuSnapshot attributesSnapshot unitPrice quantity discountAmount taxAmount lineTotal').lean(),
    Shipment.findOne({ businessId, orderId }).select('provider trackingMode shipmentId consignmentId status trackingNumber trackingUrl events bookedAt deliveredAt returnShipment createdAt updatedAt').lean(),
    Payment.findOne({ businessId, orderId }).select('provider amount currency status customerReference submittedAt verifiedAt refundedAt refundReference publicInstructions collectionDetails createdAt').lean(),
    CourierConfiguration.findOne({ businessId }).select('customerTrackingEnabled').lean() as unknown as Promise<{ customerTrackingEnabled?: boolean } | null>,
  ])
  const trackingEnabled = courierConfig?.customerTrackingEnabled !== false
  if (order.deliverySnapshot) delete order.deliverySnapshot.courierCost
  success(response, { order, items, shipment: trackingEnabled ? storedShipment : null, payment, trackingEnabled })
})

export const orderTrackingController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { orderId } = input<{ params: { orderId: string } }>(request).params
  const order = await Order.findOne({ deletedAt: { $exists: false }, _id: orderId, businessId, userId }).select('orderNumber status placedAt timeline').lean()
  if (!order) throw new AppError(404, 'order_not_found', 'Order was not found')
  const [storedShipment, courierConfig] = await Promise.all([
    Shipment.findOne({ businessId, orderId }).select('provider trackingMode shipmentId consignmentId status trackingNumber trackingUrl events bookedAt deliveredAt returnShipment updatedAt').lean(),
    CourierConfiguration.findOne({ businessId }).select('customerTrackingEnabled').lean() as unknown as Promise<{ customerTrackingEnabled?: boolean } | null>,
  ])
  const trackingEnabled = courierConfig?.customerTrackingEnabled !== false
  success(response, { order, shipment: trackingEnabled ? storedShipment : null, trackingEnabled })
})

export const wishlistController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const wishlist = await Wishlist.findOne({ businessId, userId }).populate({ path: 'productIds', match: { businessId, status: 'published' }, select: 'name slug media status' }).lean()
  const products = wishlist ? (wishlist as { productIds?: unknown[] }).productIds ?? [] : []
  success(response, { products })
})

export const wishlistAddController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { productId } = input<{ params: { productId: string } }>(request).params
  const productExists = await Product.exists({ _id: productId, businessId, status: 'published' })
  if (!productExists) throw new AppError(404, 'product_not_found', 'Product was not found')
  const wishlist = await Wishlist.findOneAndUpdate({ businessId, userId }, { $setOnInsert: { businessId, userId }, $addToSet: { productIds: productId } }, { upsert: true, new: true, runValidators: true })
  success(response, { productIds: wishlist.productIds })
})

export const wishlistRemoveController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { productId } = input<{ params: { productId: string } }>(request).params
  await Wishlist.updateOne({ businessId, userId }, { $pull: { productIds: productId } })
  success(response, { removed: true })
})

export const wishlistMoveController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { productId } = input<{ params: { productId: string }; body: { variantId: string; quantity: number } }>(request).params
  const body = input<{ params: { productId: string }; body: { variantId: string; quantity: number } }>(request).body
  const session = await mongoose.startSession()
  let result: unknown
  try {
    await session.withTransaction(async () => {
      const wishlist = await Wishlist.findOne({ businessId, userId }).session(session)
      if (!wishlist?.productIds.some((id: unknown) => String(id) === productId)) throw new AppError(404, 'wishlist_item_not_found', 'This piece is no longer in your wishlist')
      const product = await Product.findOne({ _id: productId, businessId, status: 'published' }).session(session)
      const variant = await ProductVariant.findOne({ _id: body.variantId, productId, businessId, isActive: true }).session(session)
      if (!product || !variant) throw new AppError(409, 'variant_unavailable', 'This product option is no longer available')
      const stock = await Inventory.findOne({ businessId, variantId: variant._id, locationCode: 'DEFAULT' }).session(session)
      const available = Math.max(0, (stock?.onHand ?? 0) - (stock?.reserved ?? 0))
      let cart = await Cart.findOne({ businessId, userId }).session(session)
      if (!cart) cart = new Cart({ businessId, userId, items: [] })
      const line = cart.items.find((item: { variantId: unknown }) => String(item.variantId) === body.variantId)
      const quantity = (line?.quantity ?? 0) + body.quantity
      if (quantity > 99 || quantity > available) throw new AppError(409, 'insufficient_stock', 'The requested quantity is not available')
      if (line) line.quantity = quantity
      else cart.items.push({ variantId: body.variantId, quantity: body.quantity })
      cart.revision += 1
      await cart.save({ session })
      wishlist.productIds = wishlist.productIds.filter((id: unknown) => String(id) !== productId) as typeof wishlist.productIds
      await wishlist.save({ session })
      result = { itemCount: cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0), wishlistCount: wishlist.productIds.length }
    })
  } finally { await session.endSession() }
  success(response, result)
})

export const notificationsController = asyncHandler(async (request, response) => {
  const { businessId, userId } = scope(request)
  const { page, limit } = input<{ query: { page: number; limit: number } }>(request).query
  const filter = { businessId, userId, channel: 'in_app' as const }
  const [notifications, total] = await Promise.all([
    Notification.find(filter).select('type templateKey payload status sentAt readAt createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
  ])
  success(response, { notifications }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})
