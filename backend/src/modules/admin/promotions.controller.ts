import type { Request } from 'express'
import { Coupon } from '../../models/Coupon.js'
import { Product } from '../../models/Product.js'
import { Promotion } from '../../models/Promotion.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'
function input<T>(request: Request): T { return request.validated as T }
async function validateScope(businessId: unknown, body: Record<string, any>) {
  const [products, coupon] = await Promise.all([
    body.productIds.length ? Product.countDocuments({ businessId, _id: { $in: body.productIds } }) : 0,
    body.couponId ? Coupon.exists({ _id: body.couponId, businessId }) : true,
  ])
  if (products !== body.productIds.length || !coupon) throw new AppError(422, 'promotion_scope_invalid', 'Promotion products and coupon must belong to this storefront')
}
export const adminPromotionsController = asyncHandler(async (request, response) => {
  const { page, limit, status } = input<{ query: { page: number; limit: number; status?: string } }>(request).query
  const filter = { businessId: request.business!._id, ...(status ? { status } : {}) }
  const [promotions, total] = await Promise.all([Promotion.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Promotion.countDocuments(filter)])
  success(response, { promotions }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})
export const adminPromotionCreateController = asyncHandler(async (request, response) => {
  const body = input<{ body: Record<string, any> }>(request).body
  await validateScope(request.business!._id, body)
  const promotion = await Promotion.create({ ...body, businessId: request.business!._id, createdBy: request.user?.id })
  success(response, { promotion }, 201)
})
export const adminPromotionUpdateController = asyncHandler(async (request, response) => {
  const { promotionId } = input<{ params: { promotionId: string }; body: Record<string, any> }>(request).params
  const body = input<{ params: { promotionId: string }; body: Record<string, any> }>(request).body
  await validateScope(request.business!._id, body)
  const promotion = await Promotion.findOneAndUpdate({ _id: promotionId, businessId: request.business!._id }, { $set: body }, { new: true, runValidators: true })
  if (!promotion) throw new AppError(404, 'promotion_not_found', 'Promotion was not found')
  success(response, { promotion })
})
export const adminPromotionDeleteController = asyncHandler(async (request, response) => {
  const { promotionId } = input<{ params: { promotionId: string } }>(request).params
  const promotion = await Promotion.findOneAndDelete({ _id: promotionId, businessId: request.business!._id })
  if (!promotion) throw new AppError(404, 'promotion_not_found', 'Promotion was not found')
  success(response, { deleted: true })
})
