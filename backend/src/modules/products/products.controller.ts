import type { Request } from 'express'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
import { listProducts, getProductBySlug, listRankedProducts } from './products.service.js'
import { Product } from '../../models/Product.js'
import { Review } from '../../models/Review.js'
import { AppError } from '../../utils/app-error.js'
import { ProductViewDaily } from '../../models/ProductViewDaily.js'

type ListQuery = { page: number; limit: number; q?: string; categoryId?: string; subcategoryId?: string; color?: string; size?: string; brand?: string; gender?: string; season?: string; minPrice?: number; maxPrice?: number; inStock?: string; discounted?: string; sort: 'newest' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' }
function queryFrom(request: Request): ListQuery { return (request.validated as { query: ListQuery }).query }

export const listProductsController = asyncHandler(async (request, response) => {
  const result = await listProducts({ businessId: request.business!._id, ...queryFrom(request) })
  success(response, result.items, 200, { page: result.page, limit: result.limit, total: result.total, pages: result.pages })
})

export const getProductController = asyncHandler(async (request, response) => {
  const { params: { slug } } = request.validated as { params: { slug: string } }
  const product = await getProductBySlug(request.business!._id, slug)
  const productId = (product as unknown as { _id: import('mongoose').Types.ObjectId })._id
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  await ProductViewDaily.updateOne({ businessId: request.business!._id, productId, day }, { $inc: { views: 1 }, $setOnInsert: { businessId: request.business!._id, productId, day } }, { upsert: true })
  success(response, product)
})

export const productReviewsController = asyncHandler(async (request, response) => {
  const { params: { slug }, query } = request.validated as { params: { slug: string }; query: { page: number; limit: number } }
  const product = await Product.findOne({ businessId: request.business!._id, slug, status: 'published' }).select('_id').lean() as { _id: import('mongoose').Types.ObjectId } | null
  if (!product) throw new AppError(404, 'product_not_found', 'Product was not found')
  const filter = { businessId: request.business!._id, productId: product._id, status: 'published' }
  const [reviews, total, rating] = await Promise.all([
    Review.find(filter).select('rating title body verifiedPurchase createdAt userId').populate({ path: 'userId', select: 'name' }).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: filter }, { $group: { _id: null, average: { $avg: '$rating' } } }]),
  ])
  success(response, { reviews, averageRating: rating[0]?.average ?? 0, reviewCount: total }, 200, { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) })
})

export const reviewHighlightsController = asyncHandler(async (request, response) => {
  const reviews = await Review.find({ businessId: request.business!._id, status: 'published' }).select('rating title body verifiedPurchase createdAt userId productId').populate({ path: 'userId', select: 'name' }).populate({ path: 'productId', match: { businessId: request.business!._id, status: 'published' }, select: 'name slug' }).sort({ verifiedPurchase: -1, createdAt: -1 }).limit(6).lean()
  success(response, { reviews: reviews.filter((review) => review.productId) })
})

export const bestSellersController = asyncHandler(async (request, response) => {
  const limit = Math.min(12, Math.max(1, Number(request.query.limit) || 4))
  success(response, await listRankedProducts(request.business!._id, limit))
})

export const trendingProductsController = asyncHandler(async (request, response) => {
  const limit = Math.min(12, Math.max(1, Number(request.query.limit) || 4))
  success(response, await listRankedProducts(request.business!._id, limit, 30))
})
