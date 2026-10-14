import { Types } from 'mongoose'
import { Inventory } from '../../models/Inventory.js'
import { Product } from '../../models/Product.js'
import { ProductVariant } from '../../models/ProductVariant.js'
import { OrderItem } from '../../models/OrderItem.js'
import { Order } from '../../models/Order.js'
import { AppError } from '../../utils/app-error.js'

type ProductSort = 'newest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc'
type ListInput = { businessId: Types.ObjectId; page: number; limit: number; q?: string; categoryId?: string; subcategoryId?: string; color?: string; size?: string; brand?: string; gender?: string; season?: string; minPrice?: number; maxPrice?: number; inStock?: string; discounted?: string; sort: ProductSort }
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function variantData(businessId: Types.ObjectId, productIds: Types.ObjectId[]) {
  const variants = await ProductVariant.find({ businessId, productId: { $in: productIds }, isActive: true }).select('productId sku color colorCode size price compareAtPrice currency images').lean() as unknown as Array<{ _id: Types.ObjectId; productId: Types.ObjectId; sku: string; color: string; colorCode?: string; size: string; price: number; compareAtPrice?: number; currency: string; images: unknown[] }>
  const variantIds = variants.map((variant) => variant._id)
  const inventory = await Inventory.find({ businessId, variantId: { $in: variantIds } }).select('variantId onHand reserved').lean()
  const stockByVariant = new Map(inventory.map((item) => [String(item.variantId), Math.max(0, item.onHand - item.reserved)]))
  return variants.map((variant) => ({ ...variant, stock: stockByVariant.get(String(variant._id)) ?? 0, available: (stockByVariant.get(String(variant._id)) ?? 0) > 0 }))
}

export async function listProducts(input: ListInput) {
  const filter: Record<string, unknown> = { businessId: input.businessId, status: 'published' }
  if (input.categoryId) filter.categoryId = input.categoryId
  if (input.subcategoryId) filter.subcategoryId = input.subcategoryId
  if (input.q) filter.$text = { $search: input.q }
  if (input.brand) filter.brand = new RegExp(`^${escapeRegex(input.brand)}$`, 'i')
  if (input.gender) filter.gender = input.gender
  if (input.season) filter.season = new RegExp(`^${escapeRegex(input.season)}$`, 'i')
  if (input.discounted === 'true') filter.discountPercent = { $gt: 0 }
  if (input.color || input.size || input.inStock || input.minPrice !== undefined || input.maxPrice !== undefined) {
    const variantFilter: Record<string, unknown> = { businessId: input.businessId, isActive: true }
    if (input.color) variantFilter.color = new RegExp(`^${escapeRegex(input.color)}$`, 'i')
    if (input.size) variantFilter.size = input.size.toUpperCase()
    let variants = await ProductVariant.find(variantFilter).select('_id productId price').lean() as unknown as Array<{ _id: Types.ObjectId; productId: Types.ObjectId; price: number }>
    if (input.inStock) {
      const stock = await Inventory.find({ businessId: input.businessId, variantId: { $in: variants.map((variant) => variant._id) } }).select('variantId onHand reserved').lean()
      const available = new Set(stock.filter((item) => item.onHand > item.reserved).map((item) => String(item.variantId)))
      const stocked = variants.filter((variant) => available.has(String(variant._id)))
      variants = input.inStock === 'true' ? stocked : variants.filter((variant) => !available.has(String(variant._id)))
    }
    if (input.minPrice !== undefined || input.maxPrice !== undefined) {
      const candidates = await Product.find({ businessId: input.businessId, status: 'published', _id: { $in: [...new Set(variants.map((variant) => String(variant.productId)))] } }).select('_id discountPercent').lean() as unknown as Array<{ _id: Types.ObjectId; discountPercent: number }>
      const discounts = new Map(candidates.map((product) => [String(product._id), product.discountPercent ?? 0]))
      variants = variants.filter((variant) => {
        const salePrice = Math.round(variant.price * (100 - (discounts.get(String(variant.productId)) ?? 0)) / 100)
        return (input.minPrice === undefined || salePrice >= input.minPrice) && (input.maxPrice === undefined || salePrice <= input.maxPrice)
      })
    }
    filter._id = { $in: [...new Set(variants.map((variant) => String(variant.productId)))] }
  }

  const sort: Record<string, 1 | -1> = input.sort === 'newest' ? { publishedAt: -1, _id: -1 } : input.sort === 'name_asc' ? { name: 1 } : input.sort === 'name_desc' ? { name: -1 } : input.sort === 'price_asc' ? { price: 1, _id: 1 } : { price: -1, _id: -1 }
  let priceOrder: Types.ObjectId[] | undefined
  if (input.sort === 'price_asc' || input.sort === 'price_desc') {
    // Aggregate the same active variant prices displayed by storefront cards, before pagination.
    const match = { ...filter }
    for (const key of ['categoryId', 'subcategoryId']) if (typeof match[key] === 'string') match[key] = new Types.ObjectId(match[key] as string)
    if (match._id) match._id = { $in: (match._id as { $in: string[] }).$in.map(id => new Types.ObjectId(id)) }
    const direction = input.sort === 'price_asc' ? 1 : -1
    const ranked = await Product.aggregate([
      { $match: match },
      { $lookup: { from: ProductVariant.collection.name, let: { productId: '$_id' }, pipeline: [
        { $match: { businessId: input.businessId, isActive: true, $expr: { $eq: ['$productId', '$$productId'] } } },
        { $group: { _id: null, price: { $min: '$price' } } },
      ], as: 'activePrices' } },
      { $addFields: { salePrice: { $floor: { $add: [0.5, { $multiply: [
        { $ifNull: [{ $arrayElemAt: ['$activePrices.price', 0] }, '$price'] },
        { $divide: [{ $subtract: [100, { $ifNull: ['$discountPercent', 0] }] }, 100] },
      ] }] } } } },
      { $sort: { salePrice: direction, _id: direction } },
      { $skip: (input.page - 1) * input.limit }, { $limit: input.limit }, { $project: { _id: 1 } },
    ])
    priceOrder = ranked.map(row => row._id as Types.ObjectId)
  }
  const [productRows, total] = await Promise.all([
    Product.find(priceOrder ? { ...filter, _id: { $in: priceOrder } } : filter).select('name slug sku categoryId subcategoryId brand price discountPercent media tags gender season collection publishedAt createdAt translations').populate({ path: 'categoryId', select: 'name slug translations', match: { businessId: input.businessId } }).populate({ path: 'subcategoryId', select: 'name slug translations', match: { businessId: input.businessId } }).sort(sort).skip(priceOrder ? 0 : (input.page - 1) * input.limit).limit(input.limit).lean(),
    Product.countDocuments(filter),
  ])
  const items = productRows as unknown as Array<Record<string, any>>
  if (priceOrder) {
    const ranks = new Map(priceOrder.map((id, index) => [String(id), index]))
    items.sort((a, b) => (ranks.get(String(a._id)) ?? 0) - (ranks.get(String(b._id)) ?? 0))
  }
  const visible = items.filter((item) => item.categoryId !== null)
  const variants = await variantData(input.businessId, visible.map((item) => item._id))
  const grouped = new Map<string, typeof variants>()
  for (const variant of variants) grouped.set(String(variant.productId), [...(grouped.get(String(variant.productId)) ?? []), variant])
  return { items: visible.map((item) => ({ ...item, variants: grouped.get(String(item._id)) ?? [] })), page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) }
}

export async function getProductBySlug(businessId: Types.ObjectId, slug: string) {
  const product = await Product.findOne({ businessId, slug, status: 'published' })
    .select('name slug sku description shortDescription brand price discountPercent categoryId subcategoryId media tags material fabric gender season collection seo translations publishedAt createdAt')
    .populate({ path: 'categoryId', select: 'name slug translations', match: { businessId } })
    .populate({ path: 'subcategoryId', select: 'name slug translations', match: { businessId } }).lean() as unknown as Record<string, any> | null
  if (!product || !product.categoryId) throw new AppError(404, 'product_not_found', 'Product was not found')
  const variants = await variantData(businessId, [product._id])
  return { ...product, variants }
}

export async function listRankedProducts(businessId: Types.ObjectId, limit: number, windowDays?: number) {
  const since = windowDays ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) : undefined
  const sales = await OrderItem.aggregate([
    { $match: { businessId, ...(since ? { createdAt: { $gte: since } } : {}) } },
    { $lookup: { from: Order.collection.name, localField: 'orderId', foreignField: '_id', as: 'order' } },
    { $unwind: '$order' },
    { $match: { 'order.businessId': businessId, 'order.status': 'delivered', 'order.deletedAt': { $exists: false } } },
    { $group: { _id: '$productId', units: { $sum: '$quantity' } } },
    { $sort: { units: -1, _id: 1 } }, { $limit: limit },
  ]) as Array<{ _id: Types.ObjectId; units: number }>
  if (!sales.length) return []
  const productIds = sales.map((row) => row._id)
  const products = await Product.find({ businessId, status: 'published', _id: { $in: productIds } }).select('name slug sku categoryId brand price discountPercent media tags gender season collection publishedAt translations').populate({ path: 'categoryId', select: 'name slug translations', match: { businessId } }).lean() as unknown as Array<Record<string, any>>
  const rank = new Map(sales.map((row, index) => [String(row._id), index]))
  const visible = products.filter((item) => item.categoryId !== null).sort((a, b) => (rank.get(String(a._id)) ?? Infinity) - (rank.get(String(b._id)) ?? Infinity))
  const variants = await variantData(businessId, visible.map((item) => item._id))
  const grouped = new Map<string, typeof variants>()
  for (const variant of variants) grouped.set(String(variant.productId), [...(grouped.get(String(variant.productId)) ?? []), variant])
  return visible.map((item) => ({ ...item, variants: grouped.get(String(item._id)) ?? [] }))
}

