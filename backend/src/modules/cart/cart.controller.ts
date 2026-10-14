import mongoose from 'mongoose'
import { Cart } from '../../models/Cart.js'
import { Inventory } from '../../models/Inventory.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function ownership(request: { user?: { id: string }; business?: { _id: unknown } }) {
  if (!request.user || !request.business) throw new AppError(401, 'authentication_required', 'Sign in is required')
  return { businessId: request.business._id, userId: request.user.id }
}

export const getCartController = asyncHandler(async (request, response) => {
  const { businessId, userId } = ownership(request)
  const cart = await Cart.findOne({ businessId, userId }).lean() as unknown as { items: Array<{ variantId: mongoose.Types.ObjectId; quantity: number }> } | null
  if (!cart) { success(response, { items: [], subtotal: 0, currency: 'USD' }); return }
  const variants = await ProductVariant.find({ businessId, _id: { $in: cart.items.map((item) => item.variantId) }, isActive: true }).lean()
  const variantMap = new Map(variants.map((variant) => [String(variant._id), variant]))
  const productIds = [...new Set(variants.map((variant) => String(variant.productId)))]
  const products = await Product.find({ businessId, _id: { $in: productIds }, status: 'published' }).select('name slug translations media discountPercent').lean()
  const productMap = new Map(products.map((product) => [String(product._id), product]))
  const inventory = await Inventory.find({ businessId, variantId: { $in: variants.map((variant) => variant._id) }, locationCode: 'DEFAULT' }).select('variantId onHand reserved').lean()
  const stockMap = new Map(inventory.map((item) => [String(item.variantId), Math.max(0, item.onHand - item.reserved)]))
  const items = cart.items.flatMap((item) => {
    const variant = variantMap.get(String(item.variantId))
    const product = variant && productMap.get(String(variant.productId))
    if (!variant || !product) return []
    const available = stockMap.get(String(variant._id)) ?? 0
    const discountPercent = Number((product as { discountPercent?: number }).discountPercent ?? 0)
    const price = Math.round(variant.price * (100 - discountPercent) / 100)
    return [{ variantId: variant._id, productId: product._id, name: product.name, nameTranslations: {en:product.name,bn:product.translations?.bn?.name}, slug: product.slug, image: variant.images?.[0]?.url || (product.media as Array<{ kind: string; url: string }>).find((media) => media.kind === 'image')?.url, color: variant.color, size: variant.size, sku: variant.sku, price, compareAtPrice: discountPercent > 0 ? variant.price : variant.compareAtPrice, currency: variant.currency, quantity: item.quantity, available, isAvailable: available >= item.quantity }]
  })
  const subtotal = items.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0)
  success(response, { items, subtotal, currency: items[0]?.currency ?? 'USD' })
})

export const addCartItemController = asyncHandler(async (request, response) => {
  const { businessId, userId } = ownership(request)
  const { variantId, quantity } = (request.validated as { body: { variantId: string; quantity: number } }).body
  const session = await mongoose.startSession()
  let cartResult: unknown
  try {
    await session.withTransaction(async () => {
      const variant = await ProductVariant.findOne({ _id: variantId, businessId, isActive: true }).session(session)
      if (!variant) throw new AppError(404, 'variant_unavailable', 'This product option is no longer available')
      const product = await Product.findOne({ _id: variant.productId, businessId, status: 'published' }).session(session)
      if (!product) throw new AppError(404, 'product_unavailable', 'This product is no longer available')
      const stock = await Inventory.findOne({ businessId, variantId, locationCode: 'DEFAULT' }).session(session)
      const available = Math.max(0, (stock?.onHand ?? 0) - (stock?.reserved ?? 0))
      let cart = await Cart.findOne({ businessId, userId }).session(session)
      if (!cart) cart = new Cart({ businessId, userId, items: [] })
      const line = cart.items.find((item: { variantId: unknown }) => String(item.variantId) === variantId)
      const nextQuantity = (line?.quantity ?? 0) + quantity
      if (nextQuantity > 99 || nextQuantity > available) throw new AppError(409, 'insufficient_stock', 'The requested quantity is not available')
      if (line) line.quantity = nextQuantity
      else cart.items.push({ variantId, quantity })
      cart.revision += 1
      await cart.save({ session })
      cartResult = { itemCount: cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0), revision: cart.revision }
    })
  } finally { await session.endSession() }
  success(response, cartResult)
})

export const updateCartItemController = asyncHandler(async (request, response) => {
  const { businessId, userId } = ownership(request)
  const { variantId } = (request.validated as { params: { variantId: string } }).params
  const { quantity } = (request.validated as { body: { quantity: number } }).body
  const cart = await Cart.findOne({ businessId, userId })
  if (!cart) throw new AppError(404, 'cart_not_found', 'Shopping bag was not found')
  const line = cart.items.find((item: { variantId: unknown }) => String(item.variantId) === variantId)
  if (!line) throw new AppError(404, 'cart_item_not_found', 'Shopping bag item was not found')
  const variant = await ProductVariant.findOne({ _id: variantId, businessId, isActive: true })
  const stock = variant && await Inventory.findOne({ businessId, variantId, locationCode: 'DEFAULT' })
  if (!variant || !stock || quantity > stock.onHand - stock.reserved) throw new AppError(409, 'insufficient_stock', 'The requested quantity is not available')
  line.quantity = quantity
  cart.revision += 1
  await cart.save()
  success(response, { itemCount: cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0), revision: cart.revision })
})

export const removeCartItemController = asyncHandler(async (request, response) => {
  const { businessId, userId } = ownership(request)
  const { variantId } = (request.validated as { params: { variantId: string } }).params
  const cart = await Cart.findOne({ businessId, userId })
  if (!cart) throw new AppError(404, 'cart_not_found', 'Shopping bag was not found')
  const nextItems = cart.items.filter((item: { variantId: unknown }) => String(item.variantId) !== variantId)
  if (nextItems.length === cart.items.length) throw new AppError(404, 'cart_item_not_found', 'Shopping bag item was not found')
  cart.items = nextItems
  cart.revision += 1
  await cart.save()
  success(response, { itemCount: cart.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0), revision: cart.revision })
})
