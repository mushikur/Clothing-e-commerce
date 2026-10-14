import type { Request } from 'express'
import { Category } from '../../models/Category.js'
import { Coupon } from '../../models/Coupon.js'
import { Product } from '../../models/Product.js'
import { AppError } from '../../utils/app-error.js'
import { asyncHandler } from '../../utils/async-handler.js'
import { success } from '../../utils/api-response.js'

function values<T>(request: Request): T { return request.validated as T }
export const adminCouponsController = asyncHandler(async (request, response) => {
  const { page, limit, status } = values<{ query: { page: number; limit: number; status?: 'active' | 'inactive' } }>(request).query
  const filter = { businessId: request.business!._id, ...(status ? { status } : {}) }
  const [coupons, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Coupon.countDocuments(filter)])
  success(response, { coupons }, 200, { page, limit, total, pages: Math.ceil(total / limit) })
})

export const adminCouponCreateController = asyncHandler(async (request, response) => {
  const body = values<{ body: Record<string, unknown> }>(request).body
  const productIds = body.productIds as string[]
  const categoryIds = body.categoryIds as string[]
  const [products, categories] = await Promise.all([
    productIds.length ? Product.countDocuments({ businessId: request.business!._id, _id: { $in: productIds } }) : 0,
    categoryIds.length ? Category.countDocuments({ businessId: request.business!._id, _id: { $in: categoryIds } }) : 0,
  ])
  if (products !== productIds.length || categories !== categoryIds.length) throw new AppError(422, 'coupon_scope_invalid', 'Coupon products and categories must belong to this storefront')
  try {
    const coupon = await Coupon.create({ ...body, businessId: request.business!._id, status: 'active', redemptionCount: 0 })
    success(response, { coupon }, 201)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new AppError(409, 'coupon_code_taken', 'A coupon with this code already exists in this storefront')
    throw error
  }
})

export const adminCouponStatusController = asyncHandler(async (request, response) => {
  const { couponId } = values<{ params: { couponId: string }; body: { status: 'active' | 'inactive' } }>(request).params
  const { status } = values<{ params: { couponId: string }; body: { status: 'active' | 'inactive' } }>(request).body
  const coupon = await Coupon.findOneAndUpdate({ _id: couponId, businessId: request.business!._id }, { $set: { status } }, { new: true, runValidators: true })
  if (!coupon) throw new AppError(404, 'coupon_not_found', 'Coupon was not found')
  success(response, { coupon })
})

export const adminCouponUpdateController = asyncHandler(async (request, response) => {
  const { couponId } = values<{ params: { couponId: string }; body: Record<string, unknown> }>(request).params
  const body = values<{ params: { couponId: string }; body: Record<string, unknown> }>(request).body
  const businessId = request.business!._id
  const productIds = body.productIds as string[]
  const categoryIds = body.categoryIds as string[]
  const [products, categories] = await Promise.all([
    productIds.length ? Product.countDocuments({ businessId, _id: { $in: productIds } }) : 0,
    categoryIds.length ? Category.countDocuments({ businessId, _id: { $in: categoryIds } }) : 0,
  ])
  if (products !== productIds.length || categories !== categoryIds.length) throw new AppError(422, 'coupon_scope_invalid', 'Coupon products and categories must belong to this storefront')
  try {
    const coupon = await Coupon.findOneAndUpdate({ _id: couponId, businessId }, { $set: body }, { new: true, runValidators: true })
    if (!coupon) throw new AppError(404, 'coupon_not_found', 'Coupon was not found')
    success(response, { coupon })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new AppError(409, 'coupon_code_taken', 'A coupon with this code already exists in this storefront')
    throw error
  }
})

export const adminCouponDeleteController = asyncHandler(async (request, response) => {
  const { couponId } = values<{ params: { couponId: string } }>(request).params
  const coupon = await Coupon.findOne({ _id: couponId, businessId: request.business!._id })
  if (!coupon) throw new AppError(404, 'coupon_not_found', 'Coupon was not found')
  if (coupon.redemptionCount > 0) { coupon.status = 'inactive'; await coupon.save(); success(response, { deleted: false, archived: true }) }
  else { await coupon.deleteOne(); success(response, { deleted: true }) }
})
