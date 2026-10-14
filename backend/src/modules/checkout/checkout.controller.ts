import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import mongoose, { type Types } from 'mongoose'
import type { Request } from 'express'
import { Address } from '../../models/Address.js'
import { Business } from '../../models/Business.js'
import { Cart } from '../../models/Cart.js'
import { Coupon } from '../../models/Coupon.js'
import { CourierConfiguration } from '../../models/CourierConfiguration.js'
import { Inventory } from '../../models/Inventory.js'
import { InventoryTransaction } from '../../models/InventoryTransaction.js'
import { Order } from '../../models/Order.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Payment } from '../../models/Payment.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { Shipment } from '../../models/Shipment.js'
import { User } from '../../models/User.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { paymentProvider, type PaymentMethod } from '../payments/payment-providers.js'
import { DeliveryRule } from '../../models/DeliveryRule.js'
import { ensureDeliveryDefaults, resolveDeliveryRule } from './delivery.service.js'
import { findDeliveryLocation, locationAddress } from './delivery-locations.service.js'

type CheckoutInput = {
  items: Array<{ variantId: string; quantity: number }>
  couponCode?: string
  deliveryOptionCode?: string
  deliveryAddress?: { countryCode: string; city?: string; region?: string; division?: string; district?: string; area?: string; deliveryLocationId?: string }
  paymentMethod?: PaymentMethod
  addressId?: string
  address?: { recipientName: string; phone: string; line1: string; line2?: string; city: string; region?: string; division?: string; district?: string; area?: string; deliveryLocationId?: string; deliveryLocationName?: string; deliveryZone?: string; postalCode?: string; countryCode: string; deliveryInstructions?: string }
  customer?: { name: string; email?: string; phone: string }
  notes?: string
  saveAddress?: boolean
  idempotencyKey?: string
  clearCart?: boolean
  expectedTotal?: number
}
type DeliveryOption = { code: string; label: string; labelBn?: string; fee: number; freeAbove?: number; estimatedDays?: string; enabled: boolean }
type QuoteLine = { variantId: Types.ObjectId; productId: Types.ObjectId; name: string; nameTranslations?: { en?: string; bn?: string }; slug: string; image?: string; sku: string; color: string; size: string; price: number; costPriceSnapshot?: number; compareAtPrice?: number; quantity: number; available: number; isAvailable: boolean; currency: string; categoryId: Types.ObjectId }
type Quote = { items: QuoteLine[]; subtotal: number; discountTotal: number; shippingTotal: number; total: number; currency: string; couponCode?: string; couponId?: Types.ObjectId; deliveryOption: DeliveryOption; deliverySnapshot: Record<string, unknown> }

function input<T>(request: Request): T { return request.validated as T }
function context(request: Request) {
  if (!request.business) throw new AppError(404, 'business_not_found', 'Storefront was not found')
  return { businessId: request.business._id, business: request.business, userId: request.user?.id }
}
function deliveryOptions(business: InstanceType<typeof Business>): DeliveryOption[] {
  const options = business.checkout?.deliveryOptions?.filter((option: DeliveryOption) => option.enabled) ?? []
  return options.length ? options : [{ code: 'standard', label: 'Standard delivery', fee: 0, enabled: true }]
}
function availablePayments(business: InstanceType<typeof Business>) {
  const methods: Array<{ code: PaymentMethod; label: string; merchantNumber?: string; accountType?: string; instructions?: string }> = []
  if (business.checkout?.cashOnDeliveryEnabled !== false) methods.push({ code: 'cash_on_delivery', label: 'Cash on delivery' })
  for (const method of business.checkout?.paymentMethods ?? []) {
    if (method.enabled && method.merchantNumber) methods.push({ code: method.code, label: method.code === 'bkash' ? 'bKash' : 'Nagad', merchantNumber: method.merchantNumber, accountType: method.accountType, instructions: method.instructions })
  }
  return methods
}

async function makeQuote(businessId: Types.ObjectId, deliveryList: DeliveryOption[], data: Pick<CheckoutInput, 'items' | 'couponCode' | 'deliveryOptionCode' | 'deliveryAddress' | 'paymentMethod'>, user?: { id: string; email: string }, session?: mongoose.ClientSession) : Promise<Quote> {
  const requestedIds = data.items.map((line) => line.variantId)
  const variantsQuery = ProductVariant.find({ businessId, _id: { $in: requestedIds }, isActive: true })
  if (session) variantsQuery.session(session)
  const variants = await variantsQuery.lean() as unknown as Array<Record<string, any>>
  const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]))
  if (variantMap.size !== data.items.length) throw new AppError(409, 'variant_unavailable', 'One or more selected product options are no longer available')
  const productsQuery = Product.find({ businessId, _id: { $in: variants.map((variant) => variant.productId) }, status: 'published' }).select('name slug translations discountPercent costPrice categoryId media')
  if (session) productsQuery.session(session)
  const products = await productsQuery.lean() as unknown as Array<Record<string, any>>
  const productMap = new Map(products.map((product) => [String(product._id), product]))
  if (productMap.size !== new Set(variants.map((variant) => String(variant.productId))).size) throw new AppError(409, 'product_unavailable', 'One or more selected pieces are no longer available')
  const inventoryQuery = Inventory.find({ businessId, variantId: { $in: variants.map((variant) => variant._id) }, locationCode: 'DEFAULT' }).select('variantId onHand reserved')
  if (session) inventoryQuery.session(session)
  const inventory = await inventoryQuery.lean() as unknown as Array<Record<string, any>>
  const inventoryMap = new Map(inventory.map((stock) => [String(stock.variantId), stock]))
  const quoteItems: QuoteLine[] = data.items.map((line) => {
    const variant = variantMap.get(line.variantId)!
    const product = productMap.get(String(variant.productId))!
    const stock = inventoryMap.get(line.variantId)
    if (!stock || stock.onHand - stock.reserved < line.quantity) throw new AppError(409, 'insufficient_stock', `${product.name} (${variant.color}, ${variant.size}) does not have enough stock`)
    const price = Math.round(variant.price * (100 - (product.discountPercent ?? 0)) / 100)
    const image = variant.images?.[0]?.url || product.media?.find((media: { kind: string }) => media.kind === 'image')?.url
    return { variantId: variant._id as Types.ObjectId, productId: product._id as Types.ObjectId, name: product.name, nameTranslations: { en: product.name, bn: product.translations?.bn?.name }, slug: product.slug, image, sku: variant.sku, color: variant.color, size: variant.size, price, ...(Number.isInteger(product.costPrice) ? { costPriceSnapshot: product.costPrice } : {}), compareAtPrice: price < variant.price ? variant.price : variant.compareAtPrice, quantity: line.quantity, available: stock.onHand - stock.reserved, isAvailable: true, currency: variant.currency, categoryId: product.categoryId as Types.ObjectId }
  })
  const currencies = new Set(quoteItems.map((line) => line.currency))
  if (currencies.size !== 1) throw new AppError(422, 'mixed_currency', 'A single order cannot contain products in different currencies')
  const subtotal = quoteItems.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const firstLine = quoteItems[0]
  if (!firstLine) throw new AppError(422, 'empty_order', 'Add a product before placing your order')
  const deliveryAddress = data.deliveryAddress || { countryCode: 'BD', city: 'Dhaka', division: 'Dhaka', district: 'Dhaka' }
  const resolved = await resolveDeliveryRule(businessId, deliveryAddress, subtotal, data.paymentMethod || 'cash_on_delivery')
  const shippingTotal = resolved.fee
  const deliveryOption: DeliveryOption = { code: resolved.rule.code, label: resolved.label, labelBn: resolved.labelBn, fee: resolved.fee, freeAbove: resolved.rule.freeAbove, estimatedDays: resolved.estimatedDelivery, enabled: true }
  let discountTotal = 0
  let appliedCode: string | undefined
  let appliedCouponId: Types.ObjectId | undefined
  if (data.couponCode?.trim()) {
    const code = data.couponCode.trim().toUpperCase()
    const now = new Date()
    const couponQuery = Coupon.findOne({ businessId, code, status: 'active', startsAt: { $lte: now }, endsAt: { $gte: now } })
    if (session) couponQuery.session(session)
    const coupon = await couponQuery.lean() as unknown as Record<string, any> | null
    if (!coupon || (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) || subtotal < coupon.minimumSubtotal) throw new AppError(422, 'invalid_coupon', 'This coupon is invalid, expired, or does not apply to your order')
    if (user && coupon.maxRedemptionsPerUser) {
      const filter = { businessId, ...(user.id ? { userId: user.id } : { 'customer.email': user.email }), couponId: coupon._id, status: { $nin: ['cancelled', 'refunded'] } }
      let redeemedQuery = Order.countDocuments(filter)
      if (session) redeemedQuery = redeemedQuery.session(session)
      const redeemed = await redeemedQuery
      if (redeemed >= coupon.maxRedemptionsPerUser) throw new AppError(422, 'coupon_limit_reached', 'This coupon has already been used the maximum number of times')
    }
    let eligibleSubtotal = subtotal
    if (coupon.productIds?.length || coupon.categoryIds?.length) {
      const allowedProducts = new Set(coupon.productIds?.map(String) ?? [])
      const allowedCategories = new Set(coupon.categoryIds?.map(String) ?? [])
      eligibleSubtotal = quoteItems.reduce((sum, line) => sum + (allowedProducts.has(String(line.productId)) || allowedCategories.has(String(line.categoryId)) ? line.price * line.quantity : 0), 0)
    }
    if (eligibleSubtotal < coupon.minimumSubtotal || eligibleSubtotal <= 0) throw new AppError(422, 'invalid_coupon', 'This coupon does not apply to the selected pieces')
    if (coupon.type === 'percent') discountTotal = Math.round(eligibleSubtotal * coupon.value / 100)
    else {
      if (coupon.currency && coupon.currency !== firstLine.currency) throw new AppError(422, 'invalid_coupon_currency', 'This coupon is not available in the order currency')
      discountTotal = Math.min(eligibleSubtotal, coupon.value)
    }
    appliedCode = code
    appliedCouponId = coupon._id
  }
  return { items: quoteItems, subtotal, discountTotal, shippingTotal, total: subtotal - discountTotal + shippingTotal, currency: firstLine.currency, couponCode: appliedCode, couponId: appliedCouponId, deliveryOption, deliverySnapshot: { ruleId: resolved.rule._id, name: resolved.rule.name, nameTranslations: resolved.rule.nameTranslations, code: resolved.rule.code, zone: resolved.zone, courierCode: resolved.courierCode, customerCharge: resolved.fee, courierCost: resolved.rule.courierCost, estimatedDelivery: resolved.estimatedDelivery, method: resolved.rule.courierCode ? resolved.rule.courierCode : 'area_based', paymentMethod: resolved.method } }
}

export const checkoutConfigController = asyncHandler(async (request, response) => {
  const { business } = context(request)
  await ensureDeliveryDefaults(business)
  const deliveryRules = await DeliveryRule.find({ businessId: business._id, enabled: true }).select('name nameTranslations code scope division district area zone fee freeAbove estimatedDelivery enabled').lean()
  success(response, {
    currency: business.defaultCurrency,
    guestCheckoutEnabled: business.checkout?.guestCheckoutEnabled !== false,
    paymentMethods: availablePayments(business),
    deliveryOptions: deliveryRules.map((rule) => ({ code: rule.code, label: rule.name, fee: rule.fee, freeAbove: rule.freeAbove, estimatedDays: rule.estimatedDelivery, enabled: true })),
  })
})

export const quoteCheckoutController = asyncHandler(async (request, response) => {
  const { businessId, business, userId } = context(request)
  const body = input<{ body: CheckoutInput }>(request).body
  await ensureDeliveryDefaults(business)
  const quote = await makeQuote(businessId, deliveryOptions(business), body, request.user ? { id: userId!, email: '' } : undefined)
  const { courierCost: _internalCost, ...publicDeliverySnapshot } = quote.deliverySnapshot
  const publicItems = quote.items.map(({ costPriceSnapshot: _internalProductCost, ...line }) => line)
  success(response, { ...quote, items: publicItems, deliverySnapshot: publicDeliverySnapshot })
})

export const createOrderController = asyncHandler(async (request, response) => {
  const { businessId, business, userId } = context(request)
  const body = input<{ body: CheckoutInput }>(request).body
  if (!business.checkout?.guestCheckoutEnabled && !request.user) throw new AppError(401, 'login_required', 'Sign in to place an order')
  const paymentMethod = body.paymentMethod ?? 'cash_on_delivery'
  const paymentConfig = availablePayments(business).find((method) => method.code === paymentMethod)
  if (!paymentConfig) throw new AppError(422, 'payment_method_unavailable', 'Choose an available payment method')
  const idempotencyKey = body.idempotencyKey
  if (!idempotencyKey) throw new AppError(422, 'idempotency_key_required', 'Refresh checkout and try placing your order again')
  const existing = await Order.findOne({ businessId, idempotencyKey }).select('_id orderNumber status currency subtotal discountTotal shippingTotal grandTotal createdAt paymentId').lean() as unknown as Record<string, any> | null
  if (existing) {
    const payment = existing.paymentId ? await Payment.findOne({ _id: existing.paymentId, businessId }).select('provider status publicInstructions collectionDetails').lean() as unknown as Record<string, any> | null : null
    success(response, { order: { ...existing, id: String(existing._id) }, payment: payment ? { method: payment.provider, status: payment.status, publicInstructions: payment.publicInstructions, collectionDetails: payment.collectionDetails } : undefined, reused: true }, 200); return
  }
  const session = await mongoose.startSession()
  const guestAccessToken = request.user ? undefined : randomBytes(32).toString('hex')
  let confirmation: unknown
  try {
    await session.withTransaction(async () => {
      const duplicate = await Order.findOne({ businessId, idempotencyKey }).select('_id orderNumber status currency subtotal discountTotal shippingTotal grandTotal createdAt').session(session).lean() as unknown as Record<string, any> | null
      if (duplicate) { confirmation = { order: { ...duplicate, id: String(duplicate._id) }, reused: true }; return }
      let orderBody = body
      if (request.user && body.clearCart) {
        const cart = await Cart.findOne({ businessId, userId }).session(session).lean() as unknown as { items: Array<{ variantId: Types.ObjectId; quantity: number }> } | null
        const actualLines = cart?.items ?? []
        const submitted = [...body.items].sort((a, b) => a.variantId.localeCompare(b.variantId))
        const actual = actualLines.map((line) => ({ variantId: String(line.variantId), quantity: line.quantity })).sort((a, b) => a.variantId.localeCompare(b.variantId))
        if (!actual.length || JSON.stringify(actual) !== JSON.stringify(submitted)) throw new AppError(409, 'cart_changed', 'Your bag changed in another window. Refresh checkout and review the updated pieces.')
        orderBody = { ...body, items: actual.map((line) => ({ variantId: line.variantId, quantity: line.quantity })) }
      }
      let customer: { name: string; email?: string; phone: string }
      if (request.user) {
        const user = await User.findOne({ _id: userId, businessId, status: 'active' }).select('name email phone').session(session).lean() as unknown as Record<string, any> | null
        if (!user) throw new AppError(401, 'authentication_required', 'Your customer account is unavailable')
        customer = { name: user.name, email: user.email, phone: user.phone || body.address?.phone || '' }
      } else {
        if (!body.customer) throw new AppError(422, 'customer_details_required', 'Enter your name and phone to continue')
        customer = { name: body.customer.name, ...(body.customer.email ? { email: body.customer.email.toLowerCase() } : {}), phone: body.customer.phone }
      }
      let address: Record<string, unknown>
      const shouldSaveAddress = Boolean(request.user && body.saveAddress && !body.addressId)
      if (body.addressId) {
        if (!request.user) throw new AppError(422, 'invalid_address', 'Guest checkout requires a delivery address')
        const saved = await Address.findOne({ _id: body.addressId, businessId, userId }).session(session).lean() as unknown as Record<string, any> | null
        if (!saved) throw new AppError(422, 'invalid_address', 'Choose a saved delivery address from your account')
        address = { recipientName: saved.recipientName, phone: saved.phone, line1: saved.line1, line2: saved.line2, city: saved.city, region: saved.region, division: saved.division, district: saved.district, area: saved.area, deliveryLocationId: saved.deliveryLocationId, deliveryLocationName: saved.deliveryLocationName, deliveryZone: saved.deliveryZone, postalCode: saved.postalCode, countryCode: saved.countryCode, deliveryInstructions: saved.deliveryInstructions }
      } else {
        if (!body.address) throw new AppError(422, 'address_required', 'Enter a delivery address')
        address = { ...body.address, recipientName: body.address.recipientName || customer.name, phone: body.address.phone || customer.phone }
      }
      if (!address.phone) address.phone = customer.phone
      if (!customer.phone) customer.phone = String(address.phone || '')
      if (address.deliveryLocationId) {
        const selectedLocation = await findDeliveryLocation(businessId, String(address.deliveryLocationId))
        Object.assign(address, locationAddress(selectedLocation))
      }
      if (String(address.countryCode || '').toUpperCase() === 'BD' && !address.deliveryLocationId) throw new AppError(422, 'delivery_location_required', 'Choose a delivery location from the suggestions')
      if (shouldSaveAddress && request.user) await Address.create([{ ...address, businessId, userId, isDefaultShipping: false, isDefaultBilling: false }], { session })
      await ensureDeliveryDefaults(business)
      const quote = await makeQuote(businessId, deliveryOptions(business), { ...orderBody, deliveryAddress: address as CheckoutInput['deliveryAddress'], paymentMethod }, request.user ? { id: userId!, email: customer.email || '' } : customer.email ? { id: '', email: customer.email } : undefined, session)
      if (body.expectedTotal !== undefined && body.expectedTotal !== quote.total) throw new AppError(409, 'quote_changed', 'Your total changed. Review the updated order total before placing it.')
      if (body.couponCode) {
        const coupon = quote.couponId ? await Coupon.findOne({ _id: quote.couponId, businessId, status: 'active', startsAt: { $lte: new Date() }, endsAt: { $gte: new Date() } }).session(session) : null
        if (!coupon) throw new AppError(422, 'invalid_coupon', 'This coupon is no longer available')
        if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) throw new AppError(422, 'coupon_limit_reached', 'This coupon is no longer available')
        if (request.user && coupon.maxRedemptionsPerUser) {
          const redeemed = await Order.countDocuments({ businessId, userId, couponId: coupon._id, status: { $nin: ['cancelled', 'refunded'] } }).session(session)
          if (redeemed >= coupon.maxRedemptionsPerUser) throw new AppError(422, 'coupon_limit_reached', 'This coupon has already been used the maximum number of times')
        }
        coupon.redemptionCount += 1
        await coupon.save({ session })
      }
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`
      const [order] = await Order.create([{
        businessId, userId, customer, idempotencyKey, orderNumber, ...(guestAccessToken ? { guestAccessTokenHash: createHash('sha256').update(guestAccessToken).digest('hex'), guestAccessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } : {}), status: 'pending', currency: quote.currency,
        subtotal: quote.subtotal, discountTotal: quote.discountTotal, shippingTotal: quote.shippingTotal,
        deliveryOptionCode: quote.deliveryOption.code, deliveryOptionLabel: quote.deliveryOption.label, deliverySnapshot: quote.deliverySnapshot,
        grandTotal: quote.total, couponId: quote.couponId, couponCodeSnapshot: quote.couponCode,
        shippingAddress: address, billingAddress: address, placedAt: new Date(), notes: body.notes,
      }], { session })
      const orderLines = quote.items.map((line) => ({
        businessId, orderId: order._id, productId: line.productId, variantId: line.variantId,
        productNameSnapshot: line.name, productNameTranslations: line.nameTranslations, skuSnapshot: line.sku, attributesSnapshot: { color: line.color, size: line.size },
        unitPrice: line.price, ...(line.costPriceSnapshot !== undefined ? { costPriceSnapshot: line.costPriceSnapshot } : {}), quantity: line.quantity, discountAmount: 0, taxAmount: 0, lineTotal: line.price * line.quantity,
      }))
      await OrderItem.insertMany(orderLines, { session })
      for (const line of quote.items) {
        const stock = await Inventory.findOneAndUpdate(
          { businessId, variantId: line.variantId, locationCode: 'DEFAULT', $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, line.quantity] } },
          { $inc: { reserved: line.quantity } }, { new: true, session },
        )
        if (!stock) throw new AppError(409, 'insufficient_stock', `${line.name} is no longer available in the selected quantity`)
        await InventoryTransaction.create([{ businessId, inventoryId: stock._id, variantId: line.variantId, type: 'reservation', quantityDelta: line.quantity, reason: `Reserved for order ${orderNumber}`, sourceType: 'order', sourceId: order._id, idempotencyKey: `${idempotencyKey}:${line.variantId}`, actorUserId: userId }], { session })
      }
      const collectionDetails = paymentMethod === 'cash_on_delivery' ? undefined : { merchantNumber: paymentConfig.merchantNumber, accountType: paymentConfig.accountType, instructions: paymentConfig.instructions }
      const started = await paymentProvider(paymentMethod).start({ amount: quote.total, currency: quote.currency, idempotencyKey, merchantNumber: paymentConfig.merchantNumber, accountType: paymentConfig.accountType, instructions: paymentConfig.instructions })
      const [payment] = await Payment.create([{ businessId, orderId: order._id, provider: paymentMethod, amount: quote.total, currency: quote.currency, status: started.status, publicInstructions: started.publicInstructions, collectionDetails, idempotencyKey }], { session })
      order.paymentId = payment._id
      order.timeline.push({ status: order.status, note: `Order placed with ${paymentMethod === 'cash_on_delivery' ? 'cash on delivery' : paymentMethod === 'bkash' ? 'bKash' : 'Nagad'}`, occurredAt: new Date() })
      await order.save({ session })
      if (request.user && body.clearCart) await Cart.deleteOne({ businessId, userId }, { session })
      confirmation = { order: { id: order.id, orderNumber, status: order.status, currency: order.currency, subtotal: order.subtotal, discountTotal: order.discountTotal, shippingTotal: order.shippingTotal, grandTotal: order.grandTotal, createdAt: order.createdAt }, payment: { method: paymentMethod, status: payment.status, publicInstructions: payment.publicInstructions, collectionDetails: payment.collectionDetails }, ...(guestAccessToken ? { guestAccessToken } : {}), reused: false }
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const raced = await Order.findOne({ businessId, idempotencyKey }).select('_id orderNumber status currency subtotal discountTotal shippingTotal grandTotal createdAt').lean() as unknown as Record<string, any> | null
      if (raced) { success(response, { order: { ...raced, id: String(raced._id) }, reused: true }); return }
    }
    throw error
  } finally { await session.endSession() }
  success(response, confirmation, 201)
})

export const guestOrderDetailController = asyncHandler(async (request, response) => {
  const { businessId } = context(request)
  const { orderId } = input<{ params: { orderId: string } }>(request).params
  const token = request.get('X-Guest-Order-Token') || ''
  if (!/^[a-f\d]{64}$/i.test(token)) throw new AppError(401, 'guest_order_access_required', 'Use the order access link from your confirmation to view this order')
  const order = await Order.findOne({ _id: orderId, businessId, userId: { $exists: false } }).select('+guestAccessTokenHash').lean() as unknown as Record<string, any> | null
  const suppliedHash = Buffer.from(createHash('sha256').update(token).digest('hex'), 'hex')
  const storedHash = order?.guestAccessTokenHash ? Buffer.from(order.guestAccessTokenHash, 'hex') : Buffer.alloc(32)
  if (!order || !order.guestAccessExpiresAt || new Date(order.guestAccessExpiresAt) <= new Date() || storedHash.length !== suppliedHash.length || !timingSafeEqual(storedHash, suppliedHash)) throw new AppError(404, 'order_not_found', 'Order was not found')
  const [items, storedShipment, payment, courierConfig] = await Promise.all([
    OrderItem.find({ businessId, orderId }).select('productNameSnapshot productNameTranslations skuSnapshot attributesSnapshot unitPrice quantity discountAmount taxAmount lineTotal').lean(),
    Shipment.findOne({ businessId, orderId }).select('provider trackingMode shipmentId consignmentId status trackingNumber trackingUrl events bookedAt deliveredAt returnShipment updatedAt').lean(),
    Payment.findOne({ businessId, orderId }).select('provider amount currency status customerReference submittedAt verifiedAt refundedAt refundReference publicInstructions collectionDetails createdAt').lean(),
    CourierConfiguration.findOne({ businessId }).select('customerTrackingEnabled').lean() as unknown as Promise<{ customerTrackingEnabled?: boolean } | null>,
  ])
  const trackingEnabled = courierConfig?.customerTrackingEnabled !== false
  if (order.deliverySnapshot) delete order.deliverySnapshot.courierCost
  delete order.guestAccessTokenHash
  success(response, { order, items, shipment: trackingEnabled ? storedShipment : null, payment, trackingEnabled })
})

export const updateCheckoutPolicyController = asyncHandler(async (request, response) => {
  const { business } = context(request)
  const policy = input<{ body: { guestCheckoutEnabled: boolean; cashOnDeliveryEnabled: boolean; deliveryOptions: DeliveryOption[] } }>(request).body
  business.checkout = policy as never
  await business.save()
  success(response, { checkout: business.checkout })
})
